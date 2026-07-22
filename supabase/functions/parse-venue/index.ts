// Universal venue parser (parse-venue) — v2, phased.
//
// Three independent phases per venue so no slow step can abort another
// mid-insert (Supabase kills edge requests at ~150s wall clock):
//   extract   — claude-sonnet-4-6, SOURCE language only, one call per HTML
//               page / per 5-post telegram chunk (newest 10, two chunks,
//               inserted chunk-by-chunk). Captures a raw cover URL or the
//               event's own detail-page URL for phase `covers`.
//   translate — claude-haiku-4-5 (same model as parse-dcloza), batched;
//               fills title_i18n/description_i18n (en/ru/sr) for rows where
//               title_i18n is null, using DC Loža's translation rules.
//   covers    — no LLM. Re-hosts raw cover URLs (telegram CDN expires) or
//               resolves og:image from the event's detail page, into the
//               event-covers bucket. Per-image timeout + one retry.
//
// Invoke: POST {"venue_id": "...", "phase": "extract"|"translate"|"covers"}
// (phase defaults to extract; venue_id is required — no batch mode).
// Dedup stays the events_dedup_idx unique index (venue, starts_at,
// lower(title)); a 23505 backfills covers/source_url on the existing row.
// events.title stays in the SOURCE language — rewriting it would break the
// dedup key on re-parses; the app reads title_i18n with a scalar fallback.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonrepair } from 'npm:jsonrepair@3';

const TZ = 'Europe/Belgrade';
const EXTRACT_MODEL = 'claude-sonnet-4-6';
const TRANSLATE_MODEL = 'claude-haiku-4-5'; // matches parse-dcloza
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MAX_PAYLOAD_CHARS = 50_000;
const MAX_MONTHS_AHEAD = 12;
const TELEGRAM_POSTS = 10; // newest N posts, split into chunks of…
const TELEGRAM_CHUNK = 5;
const TRANSLATE_BATCH = 10;
const PHASE_TIME_BUDGET_MS = 100_000; // stop starting new work past this; re-run resumes
const STORAGE_BUCKET = 'event-covers';
const PUBLIC_OBJECT_MARKER = '/storage/v1/object/public/';
const APIFY_ACTOR = 'apify~instagram-post-scraper';
const INSTAGRAM_POSTS = 12;
const INSTAGRAM_NEWER_THAN = '21 days';
// Realistic browser UA: several venue sites (domomladine.org) 403 bot-looking agents.
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

type Admin = ReturnType<typeof createClient>;

interface Source {
  id: string;
  kind: string;
  handle: string;
  url: string;
  city_id: string;
  venue_id: string;
}

interface ExtractedEvent {
  title: string;
  description: string | null;
  date_start: string;
  date_end: string | null;
  price_min_rsd: number | null;
  is_free: boolean | null;
  event_url: string | null;
  image_url: string | null;
  category: string | null;
}

const CATEGORIES = new Set(['music', 'party', 'art', 'food', 'cinema', 'theatre', 'market', 'other']);

// ── Timezone (same approach as parse-dcloza) ─────────────────────────────────
function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return (asUTC - instant.getTime()) / 60000;
}

/** Belgrade wall-clock ('YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM[:SS]') → UTC ISO instant. */
function belgradeToInstant(local: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const naiveUTC = Date.UTC(+y, +mo - 1, +d, h ? +h : 0, mi ? +mi : 0, s ? +s : 0);
  const offset = tzOffsetMinutes(new Date(naiveUTC), TZ);
  return new Date(naiveUTC - offset * 60000).toISOString();
}

/**
 * GET with a realistic UA and retry-with-backoff (network errors, 403/408/429/
 * 5xx). Non-retryable statuses (404 …) fail immediately; a persistently
 * blocked venue still THROWS so the run fails loud instead of silently
 * dropping — the venue then shows up in ingest_runs.error_detail.
 */
async function fetchWithRetry(url: string, timeoutMs: number): Promise<Response> {
  const delays = [0, 2000, 5000];
  let last = '';
  for (const delay of delays) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': BROWSER_UA,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'sr,en;q=0.8',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return res;
      last = `HTTP ${res.status}`;
      if (![403, 408, 429, 500, 502, 503, 504].includes(res.status)) break;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`fetch ${url} → ${last} (after retries)`);
}

// ── HTML → text (links preserved so the LLM can emit event_url) ──────────────
/** `origin` resolves root-relative hrefs (tickets.rs links events as /event/…). */
function cleanHtml(html: string, origin = ''): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Keep <header>: WP themes commonly render event hero-sliders inside it
    // (drugstorebeograd.com); the prompt already ignores navigation noise.
    .replace(/<(nav|footer)[\s\S]*?<\/\1>/gi, ' ')
    // Keep event detail-page links: <a href="U">T</a> → "T (U)".
    .replace(
      /<a\b[^>]*href="((?:https?:\/\/|\/)[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_, href: string, text: string) =>
        `${text} (${href.startsWith('/') ? origin + href : href})`,
    )
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&#8217;/g, "'")
    // Typographic quotes stay typographic: ASCII " inside titles made the
    // model emit unescaped quotes in JSON strings (deterministic parse fail).
    .replace(/&quot;|&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8222;/g, '„')
    .replace(/\s+/g, ' ')
    .trim();
}

/** t.me/s preview → newest N post blocks (post date + cover URL inline). */
function telegramPosts(html: string, handle: string): string[] {
  const blocks = html.split(
    new RegExp(`(?=<div class="tgme_widget_message[^"]*?" data-post="${handle}/)`),
  );
  const posts: string[] = [];
  for (const block of blocks) {
    const idMatch = block.match(new RegExp(`data-post="${handle}/(\\d+)"`));
    if (!idMatch) continue;
    const dateMatch = block.match(/<time[^>]*datetime="([^"]+)"/);
    const photoMatch = block.match(
      /tgme_widget_message_photo_wrap[^>]*?background-image:url\('([^']+)'\)/,
    );
    const textMatch = block.match(
      /<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>/,
    );
    const text = textMatch ? cleanHtml(textMatch[1].replace(/<br\s*\/?>/gi, '\n')) : '';
    if (!text) continue;
    posts.push(
      `POST https://t.me/${handle}/${idMatch[1]} | published: ${dateMatch?.[1] ?? 'unknown'} | image: ${photoMatch?.[1] ?? 'none'}\n${text}`,
    );
  }
  return posts.slice(-TELEGRAM_POSTS);
}

// ── Claude plumbing ──────────────────────────────────────────────────────────
// Plain-text strict JSON, not tool_use: tool grammars may \u-escape Cyrillic
// and Russian outputs are already the slowest part of the pipeline.
async function claudeCall(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
  timeoutMs: number,
): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  if (data.stop_reason === 'max_tokens') throw new Error('response truncated at max_tokens');
  return (data.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('');
}

/**
 * Parse an LLM response into a JSON array: native JSON.parse first (fast path),
 * then a jsonrepair pass (sonnet-4-6 deterministically emits unescaped inner
 * quotes in its own prose — retries reproduce the same bytes, so repair, don't
 * re-ask). `via` reports which path succeeded so the caller can log telemetry.
 * Throws when the text has no [...] block or repair still doesn't yield an
 * array — the caller must fail loud, never drop the batch silently.
 */
function parseWithRepair<T>(raw: string): { data: T[]; via: 'native' | 'repair' } {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end <= start) throw new Error('no JSON array in response');
  const slice = raw.slice(start, end + 1);
  try {
    const parsed = JSON.parse(slice);
    if (!Array.isArray(parsed)) throw new Error('not an array');
    return { data: parsed as T[], via: 'native' };
  } catch {
    const parsed = JSON.parse(jsonrepair(slice)); // throws JSONRepairError on hopeless input
    if (!Array.isArray(parsed)) throw new Error('repaired JSON is not an array');
    return { data: parsed as T[], via: 'repair' };
  }
}

/** Truncated raw-output snippet for post-mortem (first ~1k + last ~1k chars). */
function rawSnippet(raw: string): string {
  return raw.length > 2100 ? `${raw.slice(0, 1000)}\n…[truncated]…\n${raw.slice(-1000)}` : raw;
}

async function logIngestError(
  admin: Admin,
  venueId: string,
  phase: string,
  kind: 'repair_needed' | 'unparseable',
  message: string,
  raw: string,
): Promise<void> {
  await admin.from('ingest_errors').insert({
    venue_id: venueId,
    phase,
    error_kind: kind,
    error_message: message,
    raw_output: rawSnippet(raw),
  });
}

/**
 * One LLM call → parsed array, with parse telemetry. On 'repair_needed' the
 * batch still succeeds (info row); on 'unparseable' this THROWS after logging —
 * callers surface it in the phase summary so the run is never falsely green.
 */
async function claudeJsonArray<T>(
  admin: Admin,
  venueId: string,
  phase: string,
  apiKey: string,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
  timeoutMs: number,
  rawOverride?: string, // test hook: parse this instead of calling the API
): Promise<{ data: T[]; via: 'native' | 'repair' }> {
  const raw = rawOverride ?? (await claudeCall(apiKey, model, system, user, maxTokens, timeoutMs));
  try {
    const result = parseWithRepair<T>(raw);
    if (result.via === 'repair') {
      await logIngestError(admin, venueId, phase, 'repair_needed', 'parsed only after jsonrepair', raw);
    }
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logIngestError(admin, venueId, phase, 'unparseable', message, raw);
    throw new Error(`unparseable LLM output (logged to ingest_errors): ${message}`);
  }
}

// ── Phase: extract ───────────────────────────────────────────────────────────
const EXTRACT_SPEC = `Respond with ONLY a JSON array — no prose, no markdown fences. Each element:
{
  "title": string,                     // in the SOURCE language, verbatim from the page — do NOT translate
  "description": string | null,        // ONE short sentence (max ~15 words) in the SOURCE language
  "date_start": string,                // Belgrade local naive ISO 'YYYY-MM-DDTHH:MM:SS' (no offset); 'YYYY-MM-DD' when no time is stated (exhibitions)
  "date_end": string | null,           // same format; only for ranges (exhibitions/festivals)
  "price_min_rsd": number | null,      // minimum ticket price as plain number ("od 4.500,00 RSD" → 4500)
  "is_free": boolean | null,
  "event_url": string | null,          // the event's OWN detail-page URL when the page links one — look for "(https://...)" after the title
  "image_url": string | null,          // a poster/image URL when directly available
  "category": "music" | "party" | "art" | "food" | "cinema" | "theatre" | "market" | "other" | null
}
Escape any double quotes inside JSON string values (Serbian titles often contain "quoted" names).
Return [] if the input has no resolvable upcoming events.`;

function extractPrompt(source: Source, venueName: string): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  return `You extract structured events from one venue's page as STRICT JSON (never prose). The venue is ALWAYS "${venueName}" (Serbia); never extract other venues.

${EXTRACT_SPEC}

Today is ${today} (Europe/Belgrade).

RULES:
- DATES are usually in Serbian: "Ponedeljak, 20. jul 2026. u 20.00" → 2026-07-20T20:00:00; "05. oktobar 2026 20:00" → 2026-10-05T20:00:00; ranges "Od 27. maja do 31. avgusta 2026." are exhibitions → date_start=2026-05-27, date_end=2026-08-31, date-only (no time). English dates ("05 October 2026 20:00") work the same. Return Belgrade local naive ISO, NO timezone offset.
- SKIP any event whose date cannot be resolved. NEVER guess or hallucinate a date. Skip events already fully in the past (a range ending in the future is fine).
- DEDUPLICATE: pages often repeat the same event many times (calendar shows one exhibition on every day; ticketing pages duplicate their listings). Output each distinct event EXACTLY ONCE, using its full range when shown.
- PRICES: "Ulaznice od 4.500,00 RSD" / "od 2.500,00" → price_min_rsd: 4500 / 2500 (Serbian format: "." thousands, "," decimals). "donacija"/"донат" → price_min_rsd null, is_free false. Explicitly free → is_free true.
- IGNORE navigation, SEO keyword spam, "Ostala mesta u blizini" (nearby-venue) sections, and unrelated cities.
${source.kind === 'telegram'
    ? `- The input is a list of Telegram channel posts. Posts may omit the YEAR — infer it from the post's "published:" date (the event is on or shortly after it). Skip weekly schedule digests bundling many events, promos, and posts without a concrete event date. Use the post's image URL as image_url and the post URL as event_url.`
    : source.kind === 'instagram'
      ? `- The input is a list of Instagram posts; each starts with a "published:" date and a "url:" permalink, then the caption. Infer the YEAR from "published:". Skip weekly digests, promos, giveaways, and posts without a concrete date. Set event_url to the post's "url:" permalink EXACTLY. Leave image_url null.`
      : `- event_url/image_url only from URLs literally present in the input; null otherwise.`}
- CATEGORY: one of music, party, art, food, cinema, theatre, market, other. Exhibitions → "art", film → "cinema", concerts → "music", DJ/club → "party", ballet/opera/plays/talk-show-style stage shows → "theatre", lectures/games/workshops → "other". Null if truly unclear.
- Keep title and description in the page's OWN language — translation happens in a separate pass.`;
}

interface ExistingRow {
  id: string;
  title: string;
  starts_at: string;
  covers: string[] | null;
  source_url: string | null;
}

interface ExtractSummary {
  phase: 'extract';
  venue: string;
  fetched_bytes: number;
  chunks: number;
  parsed_via: ('native' | 'repair')[];
  events_extracted: number;
  events_upserted: number;
  backfilled: number;
  duplicates: number;
  dropped_invalid: number;
  errors: string[];
  samples: unknown[];
  elapsed_ms: number;
}

async function fetchInstagramPosts(
  handle: string,
): Promise<{ payloads: string[]; coverByPermalink: Map<string, string> }> {
  const token = Deno.env.get('APIFY_TOKEN');
  if (!token) throw new Error('APIFY_TOKEN secret not set (instagram source)');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  let items: Array<Record<string, unknown>>;
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username: [handle],
          resultsLimit: INSTAGRAM_POSTS,
          onlyPostsNewerThan: INSTAGRAM_NEWER_THAN,
          skipPinnedPosts: true,
          addParentData: false,
        }),
        signal: ctrl.signal,
      },
    );
    if (!res.ok) throw new Error(`apify ${res.status}: ${(await res.text()).slice(0, 200)}`);
    items = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const coverByPermalink = new Map<string, string>();
  const posts: string[] = [];
  for (const it of items) {
    const caption = typeof it.caption === 'string' ? it.caption : '';
    const permalink = typeof it.url === 'string' ? it.url : '';
    if (!caption || !permalink) continue; // private / media-only rows come back empty
    const published = typeof it.timestamp === 'string' ? it.timestamp : '';
    const cover =
      (typeof it.displayUrl === 'string' && it.displayUrl) ||
      (Array.isArray(it.childPosts) &&
        (it.childPosts[0] as { displayUrl?: string })?.displayUrl) ||
      '';
    if (cover) coverByPermalink.set(permalink, cover);
    posts.push(`published: ${published}\nurl: ${permalink}\n\n${caption}`);
  }
  if (!posts.length) throw new Error(`no public posts for @${handle}`);

  const payloads: string[] = [];
  for (let i = 0; i < posts.length; i += TELEGRAM_CHUNK) {
    payloads.push(posts.slice(i, i + TELEGRAM_CHUNK).join('\n\n---\n\n'));
  }
  return { payloads, coverByPermalink };
}

async function phaseExtract(
  admin: Admin,
  source: Source,
  venueName: string,
  apiKey: string,
  testRaw?: string,
): Promise<ExtractSummary> {
  const t0 = Date.now();
  const summary: ExtractSummary = {
    phase: 'extract', venue: venueName, fetched_bytes: 0, chunks: 0,
    parsed_via: [], events_extracted: 0, events_upserted: 0, backfilled: 0,
    duplicates: 0, dropped_invalid: 0, errors: [], samples: [], elapsed_ms: 0,
  };

  // Test hook: with `testRaw` set, skip fetch + Claude and parse `testRaw` as
  // the LLM output for one synthetic chunk — exercises the repair/unparseable
  // path end-to-end incl. ingest_errors + non-green summary.
  let html = '';
  let igPayloads: string[] = [];
  let coverByPermalink: Map<string, string> | undefined;
  if (source.kind === 'instagram') {
    const ig = await fetchInstagramPosts(source.handle); // Apify list of posts; no HTML fetch
    igPayloads = ig.payloads;
    coverByPermalink = ig.coverByPermalink;
  } else if (!testRaw) {
    const pageRes = await fetchWithRetry(source.url, 20_000);
    html = await pageRes.text();
    summary.fetched_bytes = html.length;
  }

  // Payloads: instagram/telegram in chunks of 5 posts, HTML as one capped blob.
  const payloads = testRaw
    ? ['test hook']
    : source.kind === 'instagram'
      ? igPayloads
      : source.kind === 'telegram'
        ? (() => {
            const posts = telegramPosts(html, source.handle);
            const chunks: string[] = [];
            for (let i = 0; i < posts.length; i += TELEGRAM_CHUNK) {
              chunks.push(posts.slice(i, i + TELEGRAM_CHUNK).join('\n\n---\n\n'));
            }
            return chunks;
          })()
        : [cleanHtml(html, new URL(source.url).origin).slice(0, MAX_PAYLOAD_CHARS)];
  if (!payloads.length || !payloads[0]) throw new Error('empty payload after cleaning');

  // Existing rows for 23505-backfill matching (few rows; matched in JS).
  const { data: existingRows } = await admin
    .from('events')
    .select('id, title, starts_at, covers, source_url')
    .eq('venue_id', source.venue_id);
  const existing = (existingRows ?? []) as ExistingRow[];

  const now = Date.now();
  const horizon = now + MAX_MONTHS_AHEAD * 30 * 24 * 3600 * 1000;
  const seen = new Set<string>();
  const system = extractPrompt(source, venueName);
  // Per-chunk timeout = min(90s, remaining wall-clock budget). RU chunks
  // measure 25-72s depending on content and API load; a fixed cap either
  // wastes budget or kills healthy calls. A chunk that can't start within
  // the budget is reported and picked up by a re-run (inserts are per-chunk,
  // so nothing already extracted is lost).
  const deadline = t0 + 140_000; // leave ~10s of the 150s wall clock for inserts

  for (const payload of payloads) {
    summary.chunks += 1;
    const timeoutMs = Math.min(payloads.length > 1 ? 90_000 : 125_000, deadline - Date.now());
    if (timeoutMs < 10_000) {
      summary.errors.push(`chunk ${summary.chunks}: skipped, out of time budget; re-run to resume`);
      continue;
    }
    let extracted: ExtractedEvent[];
    try {
      const result = await claudeJsonArray<ExtractedEvent>(
        admin, source.venue_id, 'extract',
        apiKey, EXTRACT_MODEL, system,
        `VENUE PAGE (${source.url}):\n\n${payload}`, 4096, timeoutMs,
        testRaw,
      );
      extracted = result.data;
      summary.parsed_via.push(result.via);
    } catch (e) {
      // A failed chunk must not lose the other chunk's events — but the run
      // goes non-green and the raw output is already in ingest_errors.
      summary.errors.push(`chunk ${summary.chunks}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    summary.events_extracted += extracted.length;

    for (const ev of extracted) {
      const startsAt = ev.title?.trim() ? belgradeToInstant(ev.date_start ?? '') : null;
      const endsAt = ev.date_end ? belgradeToInstant(ev.date_end) : null;
      // Keep ongoing ranges (exhibitions): drop only when the whole event is past.
      const lastMoment = endsAt ?? startsAt;
      if (!startsAt || Date.parse(lastMoment!) < now || Date.parse(startsAt) > horizon) {
        summary.dropped_invalid += 1;
        continue;
      }
      const key = `${ev.title.trim().toLowerCase()}|${startsAt}`;
      if (seen.has(key)) {
        summary.duplicates += 1;
        continue;
      }
      seen.add(key);
      const cover = source.kind === 'instagram'
        ? (ev.event_url ? coverByPermalink?.get(ev.event_url) ?? null : null)
        : (ev.image_url ?? null);

      const { error: insErr } = await admin.from('events').insert({
        city_id: source.city_id,
        venue_id: source.venue_id,
        title: ev.title.trim(),
        description: ev.description || null,
        category: CATEGORIES.has(ev.category ?? '') ? ev.category : 'other',
        starts_at: startsAt,
        ends_at: endsAt,
        price_text: ev.price_min_rsd != null ? `od ${ev.price_min_rsd} RSD` : null,
        is_free: ev.is_free ?? false,
        covers: cover ? [cover] : null, // raw URL; phase `covers` re-hosts
        source_type: source.kind === 'telegram' ? 'telegram' : source.kind === 'instagram' ? 'instagram' : 'website',
        source_url: ev.event_url ?? source.url,
        status: 'published',
      });

      if (insErr) {
        if (insErr.code !== '23505') {
          summary.errors.push(`insert ${ev.title}: ${insErr.message}`);
          continue;
        }
        // Dedup hit — backfill cover/detail-url the existing row is missing.
        summary.duplicates += 1;
        const match = existing.find(
          (r) =>
            r.title.toLowerCase() === ev.title.trim().toLowerCase() &&
            Date.parse(r.starts_at) === Date.parse(startsAt),
        );
        const patch: Record<string, unknown> = {};
        if (match && !match.covers?.length && cover) patch.covers = [cover];
        if (match && ev.event_url && (match.source_url === source.url || !match.source_url)) {
          patch.source_url = ev.event_url;
        }
        if (match && Object.keys(patch).length) {
          await admin.from('events').update(patch).eq('id', match.id);
          summary.backfilled += 1;
        }
        continue;
      }

      summary.events_upserted += 1;
      if (summary.samples.length < 5) {
        summary.samples.push({
          title: ev.title,
          starts_at_belgrade: ev.date_start,
          price_min_rsd: ev.price_min_rsd,
          category: ev.category,
          event_url: ev.event_url,
          image_url: ev.image_url,
        });
      }
    }
  }

  await admin.from('sources').update({ last_run_at: new Date().toISOString() }).eq('id', source.id);
  summary.elapsed_ms = Date.now() - t0;
  return summary;
}

// ── Phase: translate ─────────────────────────────────────────────────────────
// Same i18n rules as parse-dcloza so the catalog stays consistent.
const TRANSLATE_PROMPT = `You translate event listings for a Belgrade events app into English (en), Russian (ru) and Serbian (sr, Latin script).

Input: a JSON array of {id, title, description} in their source language.
Respond with ONLY a JSON array — no prose, no markdown fences:
[{ "id": string, "title_i18n": {"en": string, "ru": string, "sr": string}, "description_i18n": {"en": string, "ru": string, "sr": string} | null }]

TITLE rules (identical to the rest of the catalog):
- Translate the title ONLY when it is a DESCRIPTIVE phrase (e.g. RU "Вечер настольных игр" → EN "Board games night", SR "Veče društvenih igara"; SR "Izložba: X" → EN "Exhibition: X", RU "Выставка: X"). Otherwise keep it verbatim and IDENTICAL across en/ru/sr:
  • PROPER NOUN (band, artist, brand, show, project name): keep the NAME itself unchanged — never translate its meaning — but the SCRIPT rules below still apply: a Cyrillic name is rendered in Latin for sr and en, kept Cyrillic for ru.
  • LATIN-SCRIPT title (e.g. "French Speaking Club", "Nazareth"): keep EXACTLY as-is and IDENTICAL in all three.
  For mixed titles, translate the descriptive parts and keep proper-noun / Latin-script parts verbatim.
SCRIPT rules (apply to the FINAL strings, after the translate-vs-verbatim decision):
- sr MUST ALWAYS be Serbian Latin (latinica). Transliterate ANY Cyrillic to Latin (Ђ→Đ, Ж→Ž, Љ→Lj, Њ→Nj, Ћ→Ć, Ч→Č, Џ→Dž, Ш→Š, and all other letters 1:1). Never emit Cyrillic in the sr field — this applies to descriptive titles AND proper nouns.
- en MUST NOT contain Cyrillic. Transliterate Cyrillic proper nouns to Latin (e.g. "ЦИПЕЛИЦЕ" → "CIPELICE").
- ru keeps Cyrillic as normal.
- Latin-script input is NEVER converted to Cyrillic — these rules only romanize Cyrillic.
- DESCRIPTION: when the input description is non-null, ALWAYS provide all three languages — translate into the missing ones, concise (one sentence). When the input description is null, return description_i18n: null.
- Escape any double quotes inside JSON string values.`;

interface PendingTranslation {
  id: string;
  title: string;
  description: string | null;
}

interface TranslationResult {
  id: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string> | null;
}

interface TranslateSummary {
  phase: 'translate';
  venue: string;
  pending: number;
  translated: number;
  parsed_via: ('native' | 'repair')[];
  errors: string[];
  elapsed_ms: number;
}

async function phaseTranslate(
  admin: Admin,
  source: Source,
  venueName: string,
  apiKey: string,
): Promise<TranslateSummary> {
  const t0 = Date.now();
  const summary: TranslateSummary = {
    phase: 'translate', venue: venueName, pending: 0, translated: 0,
    parsed_via: [], errors: [], elapsed_ms: 0,
  };

  const { data: rows, error } = await admin
    .from('events')
    .select('id, title, description')
    .eq('venue_id', source.venue_id)
    .in('source_type', ['website', 'telegram', 'instagram'])
    .is('source_ref', null) // parse-venue rows only (dcloza fills its own i18n)
    .is('title_i18n', null);
  if (error) throw new Error(error.message);
  const pending = (rows ?? []) as PendingTranslation[];
  summary.pending = pending.length;

  for (let i = 0; i < pending.length; i += TRANSLATE_BATCH) {
    if (Date.now() - t0 > PHASE_TIME_BUDGET_MS) {
      summary.errors.push(`time budget hit after ${summary.translated}/${pending.length}; re-run to resume`);
      break;
    }
    const batch = pending.slice(i, i + TRANSLATE_BATCH);
    let results: TranslationResult[];
    try {
      const result = await claudeJsonArray<TranslationResult>(
        admin, source.venue_id, 'translate',
        apiKey, TRANSLATE_MODEL, TRANSLATE_PROMPT, JSON.stringify(batch), 8192, 90_000,
      );
      results = result.data;
      summary.parsed_via.push(result.via);
    } catch (e) {
      summary.errors.push(`batch ${i / TRANSLATE_BATCH + 1}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    for (const r of results) {
      if (!r?.id || !r.title_i18n?.en || !r.title_i18n?.ru || !r.title_i18n?.sr) continue;
      const { error: updErr } = await admin
        .from('events')
        .update({ title_i18n: r.title_i18n, description_i18n: r.description_i18n ?? null })
        .eq('id', r.id)
        .eq('venue_id', source.venue_id); // never cross venues even on a hallucinated id
      if (updErr) summary.errors.push(`update ${r.id}: ${updErr.message}`);
      else summary.translated += 1;
    }
  }

  summary.elapsed_ms = Date.now() - t0;
  return summary;
}

// ── Phase: covers ────────────────────────────────────────────────────────────
interface CoverRow {
  id: string;
  covers: string[] | null;
  source_url: string | null;
}

interface CoversSummary {
  phase: 'covers';
  venue: string;
  pending: number;
  resolved_inline: number;
  resolved_detail_page: number;
  unresolved: number;
  errors: string[];
  elapsed_ms: number;
}

/** Download (10s timeout, retry w/ backoff) and upload into the bucket; public URL back. */
async function rehostCover(admin: Admin, key: string, sourceUrl: string): Promise<string> {
  const imgRes = await fetchWithRetry(sourceUrl, 10_000);
  const bytes = new Uint8Array(await imgRes.arrayBuffer());
  const { error } = await admin.storage.from(STORAGE_BUCKET).upload(key, bytes, {
    contentType: imgRes.headers.get('content-type') ?? 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return admin.storage.from(STORAGE_BUCKET).getPublicUrl(key).data.publicUrl;
}

function ogImage(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ??
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ??
    // No OG/twitter meta (e.g. SNP's ticketing pages) → first img that looks
    // like an event poster by URL keyword; never generic logos/icons.
    html.match(/<img[^>]+src=["']([^"']*(?:plakat|poster|repertoire|upload\/(?:event|slika))[^"']*)["']/i);
  return m ? m[1].replace(/&amp;/g, '&') : null;
}

async function phaseCovers(admin: Admin, source: Source, venueName: string): Promise<CoversSummary> {
  const t0 = Date.now();
  const summary: CoversSummary = {
    phase: 'covers', venue: venueName, pending: 0,
    resolved_inline: 0, resolved_detail_page: 0, unresolved: 0, errors: [], elapsed_ms: 0,
  };

  const { data: rows, error } = await admin
    .from('events')
    .select('id, covers, source_url')
    .eq('venue_id', source.venue_id)
    .in('source_type', ['website', 'telegram', 'instagram'])
    .is('source_ref', null);
  if (error) throw new Error(error.message);

  const needy = ((rows ?? []) as CoverRow[]).filter(
    (r) => !r.covers?.[0]?.includes(PUBLIC_OBJECT_MARKER),
  );
  summary.pending = needy.length;

  for (const row of needy) {
    if (Date.now() - t0 > PHASE_TIME_BUDGET_MS) {
      summary.errors.push(`time budget hit with ${summary.pending - summary.resolved_inline - summary.resolved_detail_page - summary.unresolved} left; re-run to resume`);
      break;
    }
    try {
      let candidate = row.covers?.[0] ?? null;
      let via: 'inline' | 'detail' = 'inline';
      // No inline URL → try og:image on the event's own page (never the shared
      // venue calendar page — its og:image would stamp one poster on everything).
      if (!candidate && row.source_url && row.source_url !== source.url) {
        candidate = ogImage(await (await fetchWithRetry(row.source_url, 10_000)).text());
        if (candidate) candidate = new URL(candidate, row.source_url).href; // resolve relative srcs
        via = 'detail';
      }
      if (!candidate) {
        summary.unresolved += 1; // client falls back to the venue photo
        continue;
      }
      const url = await rehostCover(admin, `${source.handle}/${row.id}.jpg`, candidate);
      await admin.from('events').update({ covers: [url] }).eq('id', row.id);
      if (via === 'inline') summary.resolved_inline += 1;
      else summary.resolved_detail_page += 1;
    } catch (e) {
      summary.unresolved += 1;
      summary.errors.push(`${row.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  summary.elapsed_ms = Date.now() - t0;
  return summary;
}

// ── Handler ──────────────────────────────────────────────────────────────────
type Phase = 'extract' | 'translate' | 'covers';

Deno.serve(async (req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return Response.json({ ok: false, error: 'ANTHROPIC_API_KEY secret not set' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const params = new URL(req.url).searchParams;
  const venueId = body?.venue_id ?? params.get('venue_id');
  const phase = (body?.phase ?? params.get('phase') ?? 'extract') as Phase;
  if (!venueId) {
    return Response.json({ ok: false, error: 'venue_id is required (per-venue invocation only)' }, { status: 400 });
  }
  if (!['extract', 'translate', 'covers'].includes(phase)) {
    return Response.json({ ok: false, error: `unknown phase '${phase}'` }, { status: 400 });
  }

  const { data: source, error: srcErr } = await admin
    .from('sources')
    .select('id, kind, handle, url, city_id, venue_id')
    .eq('venue_id', venueId)
    .eq('enabled', true)
    .neq('handle', 'dcloza')
    .in('kind', ['telegram', 'official', 'tickets', 'instagram'])
    .maybeSingle();
  if (srcErr) return Response.json({ ok: false, error: srcErr.message }, { status: 500 });
  if (!source) {
    return Response.json({ ok: false, error: `no enabled source for venue ${venueId}` }, { status: 404 });
  }
  const src = source as Source;
  const { data: venue } = await admin.from('venues').select('name').eq('id', src.venue_id).single();
  const venueName = (venue?.name as string) ?? src.handle;

  // Test hook (extract only): `_test_raw` in the body is parsed as the LLM
  // output instead of fetching/calling Claude — verifies the fail-loud path.
  const testRaw = typeof body?._test_raw === 'string' ? body._test_raw : undefined;

  try {
    const summary =
      phase === 'extract'
        ? await phaseExtract(admin, src, venueName, anthropicKey, testRaw)
        : phase === 'translate'
          ? await phaseTranslate(admin, src, venueName, anthropicKey)
          : await phaseCovers(admin, src, venueName);

    await admin.from('ingest_runs').insert({
      source_handle: phase === 'extract' ? src.handle : `${src.handle}:${phase}`,
      found:
        summary.phase === 'extract' ? summary.events_extracted : summary.pending,
      inserted:
        summary.phase === 'extract'
          ? summary.events_upserted
          : summary.phase === 'translate'
            ? summary.translated
            : summary.resolved_inline + summary.resolved_detail_page,
      errors: summary.errors.length,
      error_detail: summary.errors.length ? summary.errors.join(' | ') : null,
      finished_at: new Date().toISOString(),
    });

    return Response.json({ ok: summary.errors.length === 0, ...summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from('ingest_runs').insert({
      source_handle: `${src.handle}:${phase}`,
      errors: 1,
      error_detail: message,
      finished_at: new Date().toISOString(),
    });
    return Response.json({ ok: false, phase, venue: venueName, error: message }, { status: 500 });
  }
});
