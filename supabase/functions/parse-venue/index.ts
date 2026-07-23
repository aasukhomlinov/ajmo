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
//   film      — no LLM. TMDb lookup for cinema events' film_query; fills
//               events.film with localized titles that translate then uses
//               verbatim. Runs after extract, before translate.
//
// Invoke: POST {"venue_id": "...", "phase": "extract"|"translate"|"covers"|"film"}
// (phase defaults to extract; venue_id is required — no batch mode).
// Dedup, primary: events.source_ref = the event's own URL (IG permalink /
// t.me post URL / website detail page), plus '#<title-slug>' when one post
// yields several events. A re-read of the same post UPDATES the existing row
// (time corrections included) instead of inserting a twin; events_source_ref_key
// (global unique) guards it at the DB level. Secondary: the events_dedup_idx
// unique index (venue, starts_at, lower(title)) + the fuzzy ±6h matcher
// below, for rows without a per-event URL and reworded reposts.
// events.title stays in the SOURCE language — rewriting it would break the
// dedup key on re-parses; the app reads title_i18n with a scalar fallback.
//
// Recap rule (strict, product decision): an IG/telegram post is either an
// ANNOUNCEMENT (announces something upcoming) or a RECAP (reports on something
// already started/happened). Recap posts yield ZERO events even when they
// mention future dates — their non-poster photos would also break the
// poster-led feed. Counted per run as skipped_recap (never an error).

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
  film_query: { title: string; year: number | null; country: string | null } | null;
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

/** t.me/s preview → newest N post blocks (post date + cover URL inline) plus a
 * deterministic post-URL → first-photo map: the LLM echoes image_url per event
 * unreliably when one post yields several events, so covers attach from the
 * map at insert (same design as the Instagram coverByPermalink). */
function telegramPosts(
  html: string,
  handle: string,
): { posts: string[]; coverByPostUrl: Map<string, string> } {
  const blocks = html.split(
    new RegExp(`(?=<div class="tgme_widget_message[^"]*?" data-post="${handle}/)`),
  );
  const posts: string[] = [];
  const coverByPostUrl = new Map<string, string>();
  for (const block of blocks) {
    const idMatch = block.match(new RegExp(`data-post="${handle}/(\\d+)"`));
    if (!idMatch) continue;
    const postUrl = `https://t.me/${handle}/${idMatch[1]}`;
    const dateMatch = block.match(/<time[^>]*datetime="([^"]+)"/);
    const photoMatch = block.match(
      /tgme_widget_message_photo_wrap[^>]*?background-image:url\('([^']+)'\)/,
    );
    if (photoMatch) coverByPostUrl.set(postUrl, photoMatch[1]); // first photo only
    const textMatch = block.match(
      /<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>/,
    );
    const text = textMatch ? cleanHtml(textMatch[1].replace(/<br\s*\/?>/gi, '\n')) : '';
    if (!text) continue;
    posts.push(
      `POST ${postUrl} | published: ${dateMatch?.[1] ?? 'unknown'} | image: ${photoMatch?.[1] ?? 'none'}\n${text}`,
    );
  }
  return { posts: posts.slice(-TELEGRAM_POSTS), coverByPostUrl };
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
/**
 * Sonnet copies Serbian „X" quotations verbatim: the ASCII closing quote lands
 * unescaped inside a JSON string, and when two such strings sit adjacent
 * (title + description) even jsonrepair gives up ('Colon expected'). Output is
 * deterministic, so retrying reproduces the same bytes. Swap the ASCII close
 * of a „…" pair to typographic ” — only when what follows can't be a real
 * JSON delimiter (so a legit string terminator is never touched) and the quote
 * isn't already \"-escaped.
 */
function normalizeCurlyQuotePairs(slice: string): string {
  return slice.replace(/„([^"„\n]{0,160}?)(?<!\\)"(?=\s*[^\s,}\]:"])/g, '„$1”');
}

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
    const normalized = normalizeCurlyQuotePairs(slice);
    try {
      const parsed = JSON.parse(normalized);
      if (!Array.isArray(parsed)) throw new Error('not an array');
      return { data: parsed as T[], via: 'repair' };
    } catch {
      const parsed = JSON.parse(jsonrepair(normalized)); // throws JSONRepairError on hopeless input
      if (!Array.isArray(parsed)) throw new Error('repaired JSON is not an array');
      return { data: parsed as T[], via: 'repair' };
    }
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
  kind: 'repair_needed' | 'unparseable' | 'phase_failed',
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
  "category": "music" | "party" | "art" | "food" | "cinema" | "theatre" | "market" | "other" | null,
  "film_query": { "title": string, "year": number | null, "country": string | null } | null
                                       // ONLY for category "cinema": the film's name in the SOURCE
                                       // language EXACTLY as written in the input, plus release year
                                       // and production country when stated (else null). null when
                                       // the event is not a film screening, when the film cannot be
                                       // identified, or for every non-cinema category.
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
${source.kind === 'telegram' || source.kind === 'instagram'
    ? `- The input is a list of ${source.kind === 'telegram' ? 'Telegram channel posts (each starts with "POST <url>" and a "published:" date)' : 'Instagram posts (each starts with a "published:" date and a "url:" permalink, then the caption)'}. Posts may omit the YEAR — infer it from "published:" (the event is on or shortly after it). Set event_url to the post URL EXACTLY${source.kind === 'telegram' ? '; image_url may be left null (covers attach from the post automatically)' : '. Leave image_url null'}.
- CLASSIFY EVERY POST FIRST. Before any events, emit one classification object per post: {"post": "<post url>", "kind": "announcement" | "recap" | "nonevent"}.
  • "announcement" — the post announces something upcoming (afiša, programme, lineup, ticket info).
  • "recap" — the post reports on something that already started or happened: "je zvanično počeo" / "је званично почео", thank-yous ("hvala svima"), photos/video FROM the event, atmosphere/press-report posts. Extract ZERO events from a recap — even when it mentions future dates or a remaining schedule. Never use a recap to create events.
  • "nonevent" — no event content at all (promo, giveaway, menu, weekly digest bundling many events, post without a concrete date).
  A post that BOTH announces a future date AND reports on a past one counts as "announcement" — add "ambiguous": true to its classification object so it can be reviewed; only clear recaps are skipped.
- After the classification objects, emit the event objects for announcement posts only.`
      : `- event_url/image_url only from URLs literally present in the input; null otherwise.`}
- CATEGORY: one of music, party, art, food, cinema, theatre, market, other. Exhibitions → "art", film → "cinema", concerts → "music", DJ/club → "party", ballet/opera/plays/talk-show-style stage shows → "theatre", lectures/games/workshops → "other". Null if truly unclear.
- Keep title and description in the page's OWN language — translation happens in a separate pass.`;
}

// ── Fuzzy dedup: distinctive-part title matching ─────────────────────────────
// Daily re-runs re-process the same posts and the LLM rewords titles, so exact
// (title, starts_at) matching lets near-duplicates pile up. Compare only events
// at the SAME instant, on the DISTINCTIVE tokens (title minus format/stop/venue
// noise) — "Kinoklub: X" vs "Kinoklub: Y" share a frame but stay distinct.

// Extend as needed (ru/sr/en).
const STOP_WORDS = new Set([
  's', 'sa', 'с', 'i', 'и', 'u', 'в', 'na', 'на', 'za', 'за', 'o', 'об', 'про',
  'the', 'a', 'an', 'of', 'and', 'with', 'from', 'this', 'at', 'on', 'over', 'takes',
]);
// Recurring event-format words that frame a title. Extend as needed (ru/sr/en).
// Weekday/promo framing added after the Karmakoma miss ("THIS SATURDAY |
// Karmakoma takeover…" vs "Club Drugstore takes over Karmakoma…" scored 0.67).
const FORMAT_MARKERS = new Set([
  'kinoklub', 'киноклуб', 'klub', 'клуб', 'club', 'film', 'filmski', 'фильм',
  'koncert', 'концерт', 'izlozba', 'izložba', 'выставка', 'exhibition',
  'radionica', 'workshop', 'vece', 'veče', 'večer', 'вечер',
  'zurka', 'žurka', 'party', 'забава', 'quiz', 'квиз',
  'predstava', 'представление', 'спектакль', 'dj', 'live',
  'takeover', 'tonight', 'today', 'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday',
]);

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function distinctiveTokens(title: string, venueName: string): Set<string> {
  const venueTokens = new Set(normalizeTitle(venueName).split(' '));
  const out = new Set<string>();
  for (const tok of normalizeTitle(title).split(' ')) {
    if (tok.length < 2) continue;
    if (STOP_WORDS.has(tok) || FORMAT_MARKERS.has(tok) || venueTokens.has(tok)) continue;
    if (/^\d{4}$/.test(tok)) continue; // years
    out.add(tok);
  }
  return out;
}

/** Fuzzy-dedup time window: two posts announcing one event often parse the
 * start an hour or two apart (Karmakoma 22:00 vs 23:00), so same-instant
 * matching let the pair through. ±6h merges hour-wobble but keeps a matinee
 * vs evening show (≥9h) and day-apart repertoire runs separate. */
const SAME_EVENT_WINDOW_MS = 6 * 3600_000;
function nearInstant(a: string, b: string): boolean {
  return Math.abs(Date.parse(a) - Date.parse(b)) <= SAME_EVENT_WINDOW_MS;
}

/** Near-instant titles only. All-frame titles fall back to exact normalized
 * equality so recurring formats never merge blindly. */
function isSameEvent(titleA: string, titleB: string, venueName: string): boolean {
  const a = distinctiveTokens(titleA, venueName);
  const b = distinctiveTokens(titleB, venueName);
  if (!a.size || !b.size) return normalizeTitle(titleA) === normalizeTitle(titleB);
  let shared = 0;
  for (const tok of a) if (b.has(tok)) shared += 1;
  return shared / Math.min(a.size, b.size) >= 0.7;
}

interface ExistingRow {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  covers: string[] | null;
  source_url: string | null;
  source_ref: string | null;
}

/** Per-post classification the model emits before the events (IG/telegram). */
interface PostClassification {
  post: string;
  kind: 'announcement' | 'recap' | 'nonevent';
  ambiguous?: boolean;
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
  time_corrected: number;
  dropped_invalid: number;
  skipped_recap: number;
  skipped_nonevents: number;
  recap_posts: string[];
  ambiguous_posts: string[];
  errors: string[];
  samples: unknown[];
  elapsed_ms: number;
}

/** '#<slug>' discriminator so several events from ONE post get distinct
 * source_refs (Daka0-YDG1l → 4 plays; two even share an instant). Mirrors the
 * SQL backfill in 20260723 repair migration — keep the two in sync. */
function titleSlug(title: string): string {
  return normalizeTitle(title).replace(/ /g, '-').slice(0, 80);
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
  // No recent posts is a normal state for quiet venues, not an error — a throw
  // here used to burn 3 queue retries (= 3 paid Apify calls) per night.
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
    duplicates: 0, time_corrected: 0, dropped_invalid: 0,
    skipped_recap: 0, skipped_nonevents: 0, recap_posts: [], ambiguous_posts: [],
    errors: [], samples: [], elapsed_ms: 0,
  };

  // Test hook: with `testRaw` set, skip fetch + Claude and parse `testRaw` as
  // the LLM output for one synthetic chunk — exercises the repair/unparseable
  // path end-to-end incl. ingest_errors + non-green summary.
  let html = '';
  let igPayloads: string[] = [];
  let coverByPermalink: Map<string, string> | undefined;
  let coverByPostUrl: Map<string, string> | undefined;
  if (source.kind === 'instagram' && !testRaw) {
    // testRaw must never reach Apify — a test-hook call on an IG venue would
    // otherwise bill a real actor run.
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
            const tg = telegramPosts(html, source.handle);
            coverByPostUrl = tg.coverByPostUrl;
            const chunks: string[] = [];
            for (let i = 0; i < tg.posts.length; i += TELEGRAM_CHUNK) {
              chunks.push(tg.posts.slice(i, i + TELEGRAM_CHUNK).join('\n\n---\n\n'));
            }
            return chunks;
          })()
        : [cleanHtml(html, new URL(source.url).origin).slice(0, MAX_PAYLOAD_CHARS)];
  if (source.kind === 'instagram' && !payloads.length) {
    summary.elapsed_ms = Date.now() - t0; // quiet venue: green no-op run
    return summary;
  }
  if (!payloads.length || !payloads[0]) throw new Error('empty payload after cleaning');

  // Existing rows for source_ref / 23505-backfill matching (few rows; JS-matched).
  const { data: existingRows } = await admin
    .from('events')
    .select('id, title, starts_at, ends_at, covers, source_url, source_ref')
    .eq('venue_id', source.venue_id);
  const existing = (existingRows ?? []) as ExistingRow[];

  const now = Date.now();
  const horizon = now + MAX_MONTHS_AHEAD * 30 * 24 * 3600 * 1000;
  const insertedThisRun: { title: string; startsAt: string }[] = [];
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
    let items: (ExtractedEvent | PostClassification)[];
    try {
      const result = await claudeJsonArray<ExtractedEvent | PostClassification>(
        admin, source.venue_id, 'extract',
        apiKey, EXTRACT_MODEL, system,
        `VENUE PAGE (${source.url}):\n\n${payload}`, 4096, timeoutMs,
        testRaw,
      );
      items = result.data;
      summary.parsed_via.push(result.via);
    } catch (e) {
      // A failed chunk must not lose the other chunk's events — but the run
      // goes non-green and the raw output is already in ingest_errors.
      summary.errors.push(`chunk ${summary.chunks}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    // Partition post classifications (IG/telegram) from events. Events from
    // recap posts are ALSO dropped here in code — the prompt alone is no
    // guarantee, and the recap rule is a product invariant.
    const classifications = items.filter(
      (x): x is PostClassification => typeof (x as PostClassification).post === 'string' && !('title' in x),
    );
    const recapUrls = new Set(
      classifications.filter((c) => c.kind === 'recap').map((c) => c.post),
    );
    summary.skipped_recap += recapUrls.size;
    summary.skipped_nonevents += classifications.filter((c) => c.kind === 'nonevent').length;
    summary.recap_posts.push(...recapUrls);
    summary.ambiguous_posts.push(...classifications.filter((c) => c.ambiguous).map((c) => c.post));
    const extracted = items.filter(
      (x): x is ExtractedEvent => typeof (x as ExtractedEvent).title === 'string',
    ).filter((ev) => !(ev.event_url && recapUrls.has(ev.event_url)));
    summary.events_extracted += extracted.length;

    // Several events sharing ONE post/detail URL need a per-event
    // discriminator in source_ref, else the global unique key collapses them.
    const urlCount = new Map<string, number>();
    for (const ev of extracted) {
      if (ev.event_url) urlCount.set(ev.event_url, (urlCount.get(ev.event_url) ?? 0) + 1);
    }

    for (const ev of extracted) {
      const startsAt = ev.title?.trim() ? belgradeToInstant(ev.date_start ?? '') : null;
      const endsAt = ev.date_end ? belgradeToInstant(ev.date_end) : null;
      // Keep ongoing ranges (exhibitions): drop only when the whole event is past.
      const lastMoment = endsAt ?? startsAt;
      if (!startsAt || Date.parse(lastMoment!) < now || Date.parse(startsAt) > horizon) {
        summary.dropped_invalid += 1;
        continue;
      }
      const cover = source.kind === 'instagram'
        ? (ev.event_url ? coverByPermalink?.get(ev.event_url) ?? null : null)
        : source.kind === 'telegram'
          ? ((ev.event_url ? coverByPostUrl?.get(ev.event_url) : undefined) ?? ev.image_url ?? null)
          : (ev.image_url ?? null);
      const ref = ev.event_url
        ? (urlCount.get(ev.event_url)! > 1 ? `${ev.event_url}#${titleSlug(ev.title)}` : ev.event_url)
        : null;

      // PRIMARY dedup: same source_ref = the same event re-read. A different
      // parsed time UPDATES the row (post edits / re-reads) — never a twin.
      // A stale non-storage cover is refreshed from today's fetch so phase
      // `covers` can re-host it before the CDN link expires.
      const refMatch = ref ? existing.find((r) => r.source_ref === ref) : undefined;
      if (refMatch) {
        summary.duplicates += 1;
        const patch: Record<string, unknown> = {};
        const endsParsed = endsAt ? Date.parse(endsAt) : null;
        const oldEnds = refMatch.ends_at ? Date.parse(refMatch.ends_at) : null;
        if (Date.parse(refMatch.starts_at) !== Date.parse(startsAt) || oldEnds !== endsParsed) {
          patch.starts_at = startsAt;
          patch.ends_at = endsAt;
        }
        if (cover && !refMatch.covers?.[0]?.includes(PUBLIC_OBJECT_MARKER)) patch.covers = [cover];
        if (Object.keys(patch).length) {
          const { error: updErr } = await admin.from('events').update(patch).eq('id', refMatch.id);
          if (updErr) {
            // 23505 = another row already occupies the corrected (venue,
            // time, title) slot — a duplicate for the repair flow, not an error.
            if (updErr.code !== '23505') summary.errors.push(`update ${refMatch.id}: ${updErr.message}`);
          } else {
            if (patch.starts_at) summary.time_corrected += 1;
            summary.backfilled += 1;
          }
        }
        continue;
      }

      // SECONDARY fuzzy dedup in a ±6h window: a reworded re-post of a DB
      // row merges into it (backfilling cover/detail-url/source_ref); an
      // in-run near-duplicate is just skipped.
      const dbMatch = existing.find(
        (r) => nearInstant(r.starts_at, startsAt) && isSameEvent(ev.title, r.title, venueName),
      );
      if (dbMatch) {
        summary.duplicates += 1;
        const patch: Record<string, unknown> = {};
        if (cover && !dbMatch.covers?.[0]?.includes(PUBLIC_OBJECT_MARKER)) patch.covers = [cover];
        if (ev.event_url && (dbMatch.source_url === source.url || !dbMatch.source_url)) {
          patch.source_url = ev.event_url;
        }
        if (ref && !dbMatch.source_ref) patch.source_ref = ref; // self-heal pre-backfill rows
        if (Object.keys(patch).length) {
          const { error: updErr } = await admin.from('events').update(patch).eq('id', dbMatch.id);
          if (!updErr) summary.backfilled += 1;
        }
        continue;
      }
      if (
        insertedThisRun.some(
          (p) => nearInstant(p.startsAt, startsAt) && isSameEvent(ev.title, p.title, venueName),
        )
      ) {
        summary.duplicates += 1;
        continue;
      }

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
        source_ref: ref,
        status: 'published',
        // Lookup pending until phase `film` adds `resolved` (true or false).
        film: ev.category === 'cinema' && ev.film_query?.title ? { query: ev.film_query } : null,
      });

      if (insErr) {
        if (insErr.code !== '23505') {
          summary.errors.push(`insert ${ev.title}: ${insErr.message}`);
          continue;
        }
        // Dedup hit (source_ref key or venue+time+title index) — backfill
        // cover/detail-url/source_ref the existing row is missing.
        summary.duplicates += 1;
        const match =
          (ref ? existing.find((r) => r.source_ref === ref) : undefined) ??
          existing.find(
            (r) =>
              r.title.toLowerCase() === ev.title.trim().toLowerCase() &&
              Date.parse(r.starts_at) === Date.parse(startsAt),
          );
        const patch: Record<string, unknown> = {};
        if (match && cover && !match.covers?.[0]?.includes(PUBLIC_OBJECT_MARKER)) patch.covers = [cover];
        if (match && ev.event_url && (match.source_url === source.url || !match.source_url)) {
          patch.source_url = ev.event_url;
        }
        if (match && ref && !match.source_ref) patch.source_ref = ref;
        if (match && Object.keys(patch).length) {
          const { error: updErr } = await admin.from('events').update(patch).eq('id', match.id);
          if (!updErr) summary.backfilled += 1;
        }
        continue;
      }

      summary.events_upserted += 1;
      insertedThisRun.push({ title: ev.title, startsAt });
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

Input: a JSON array of {id, title, description, film_titles?} in their source language.
Respond with ONLY a JSON array — no prose, no markdown fences:
[{ "id": string, "title_i18n": {"en": string, "ru": string, "sr": string}, "description_i18n": {"en": string, "ru": string, "sr": string} | null }]

TITLE rules (identical to the rest of the catalog):
- If film_titles is provided, it OVERRIDES every other TITLE rule (descriptive, Latin-script, proper-noun) for the FILM-NAME portion of the title: take the film name from film_titles.{en,ru,sr} instead of translating or transliterating it yourself; translate only the surrounding frame normally. The SCRIPT rules below STILL apply to the result — a Cyrillic film_titles.sr (e.g. «Опасне девојке») is romanized to Serbian Latin («Opasne devojke»), and en must never contain Cyrillic.
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
  film: { resolved?: boolean; titles?: Record<string, string> } | null;
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
    .select('id, title, description, film')
    .eq('venue_id', source.venue_id)
    // No source_ref filter: parse-venue rows carry source_ref now. The dcloza
    // venue never reaches these phases (its only source is excluded upstream).
    .in('source_type', ['website', 'telegram', 'instagram'])
    .is('title_i18n', null);
  if (error) throw new Error(error.message);
  const pending = (rows ?? []) as PendingTranslation[];
  summary.pending = pending.length;

  for (let i = 0; i < pending.length; i += TRANSLATE_BATCH) {
    if (Date.now() - t0 > PHASE_TIME_BUDGET_MS) {
      summary.errors.push(`time budget hit after ${summary.translated}/${pending.length}; re-run to resume`);
      break;
    }
    // Resolved film titles ride along as authoritative names; the raw film
    // column never reaches the LLM.
    const batch = pending.slice(i, i + TRANSLATE_BATCH).map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      ...(p.film?.resolved && p.film.titles ? { film_titles: p.film.titles } : {}),
    }));
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
    .in('source_type', ['website', 'telegram', 'instagram']);
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

// ── Phase: film ──────────────────────────────────────────────────────────────
// TMDb lookup for cinema events so titles use the film's real localized name.
// Strict: no confident hit → resolved:false and titles stay as-is (never guess).
// `resolved` present (either value) = lookup done, never retried.
const TMDB_URL = 'https://api.themoviedb.org/3';

interface FilmQuery {
  title: string;
  year: number | null;
  country: string | null;
}

interface FilmRow {
  id: string;
  film: { query: FilmQuery; resolved?: boolean } | null;
}

interface FilmSummary {
  phase: 'film';
  venue: string;
  pending: number;
  resolved: number;
  no_match: number;
  errors: string[];
  elapsed_ms: number;
}

/** v4 read tokens (JWTs) go in the Authorization header; a v3 key falls back to
 * the api_key param (we log no URLs, so the key never lands in a log line). */
async function tmdbGet(
  key: string,
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const url = new URL(`${TMDB_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const bearer = key.startsWith('eyJ');
  if (!bearer) url.searchParams.set('api_key', key);
  const res = await fetch(url, {
    headers: bearer ? { Authorization: `Bearer ${key}` } : {},
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`tmdb ${res.status} on ${path}`);
  return await res.json();
}

async function phaseFilm(admin: Admin, source: Source, venueName: string): Promise<FilmSummary> {
  const t0 = Date.now();
  const summary: FilmSummary = {
    phase: 'film', venue: venueName, pending: 0, resolved: 0, no_match: 0,
    errors: [], elapsed_ms: 0,
  };
  const tmdbKey = Deno.env.get('TMDB_API_KEY');
  if (!tmdbKey) {
    // No-op, never crash the pipeline — the run reports ok:false with this message.
    summary.errors.push('TMDB_API_KEY secret not set; film phase skipped');
    summary.elapsed_ms = Date.now() - t0;
    return summary;
  }

  const { data: rows, error } = await admin
    .from('events')
    .select('id, film')
    .eq('venue_id', source.venue_id)
    .not('film', 'is', null);
  if (error) throw new Error(error.message);
  // `film ? 'query' and not film ? 'resolved'` — filtered in JS, rows are few.
  const pending = ((rows ?? []) as FilmRow[]).filter(
    (r) => r.film?.query?.title && !('resolved' in (r.film ?? {})),
  );
  summary.pending = pending.length;

  for (const row of pending) {
    if (Date.now() - t0 > PHASE_TIME_BUDGET_MS) {
      summary.errors.push(
        `time budget hit after ${summary.resolved + summary.no_match}/${pending.length}; re-run to resume`,
      );
      break;
    }
    const query = row.film!.query;
    let film: Record<string, unknown> = { query, resolved: false };
    try {
      const search = await tmdbGet(tmdbKey, '/search/movie', {
        query: query.title,
        ...(query.year ? { year: String(query.year) } : {}),
      });
      const results = (search.results ?? []) as Array<{
        id: number;
        original_title?: string;
        release_date?: string;
      }>;
      const top = results[0];
      // Confident = top result within ±1 year; without a year, a single
      // unambiguous result. Anything else stays unresolved — never guess.
      const confident = query.year
        ? Boolean(top?.release_date) && Math.abs(Number(top.release_date!.slice(0, 4)) - query.year) <= 1
        : results.length === 1;
      if (top && confident) {
        const tr = await tmdbGet(tmdbKey, `/movie/${top.id}/translations`, {});
        const translations = (tr.translations ?? []) as Array<{
          iso_639_1: string;
          data?: { title?: string };
        }>;
        const t = (lang: string) =>
          translations.find((x) => x.iso_639_1 === lang && x.data?.title)?.data?.title ||
          top.original_title || query.title;
        film = {
          query,
          tmdb_id: top.id,
          titles: {
            original: top.original_title ?? query.title,
            en: t('en'), ru: t('ru'), sr: t('sr'),
          },
          resolved: true,
        };
        summary.resolved += 1;
      } else {
        summary.no_match += 1;
      }
    } catch (e) {
      summary.no_match += 1;
      summary.errors.push(`${row.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
    const { error: updErr } = await admin.from('events').update({ film }).eq('id', row.id);
    if (updErr) summary.errors.push(`update ${row.id}: ${updErr.message}`);
  }

  summary.elapsed_ms = Date.now() - t0;
  return summary;
}

// ── Handler ──────────────────────────────────────────────────────────────────
type Phase = 'extract' | 'translate' | 'covers' | 'film';

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
  if (!['extract', 'translate', 'covers', 'film'].includes(phase)) {
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
          : phase === 'film'
            ? await phaseFilm(admin, src, venueName)
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
            : summary.phase === 'film'
              ? summary.resolved
              : summary.resolved_inline + summary.resolved_detail_page,
      ...(summary.phase === 'extract'
        ? { skipped_recap: summary.skipped_recap, skipped_nonevents: summary.skipped_nonevents }
        : {}),
      errors: summary.errors.length,
      error_detail: summary.errors.length ? summary.errors.join(' | ') : null,
      finished_at: new Date().toISOString(),
    });

    // Fail LOUD: any error beyond a budget-resume marker returns non-200 so
    // the refresh_queue ticker retries/records it instead of marking `done`
    // (the 2026-07-23 incident: Anthropic-credit 400s inside an HTTP-200 body
    // silently killed a whole night of translations), and lands one
    // phase_failed row in ingest_errors for post-mortem.
    const realErrors = summary.errors.filter((e) => !/out of time budget|re-run to resume/.test(e));
    if (realErrors.length) {
      await logIngestError(admin, src.venue_id, phase, 'phase_failed', realErrors.join(' | '), '');
      return Response.json({ ok: false, ...summary }, { status: 500 });
    }
    return Response.json({ ok: summary.errors.length === 0, ...summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from('ingest_runs').insert({
      source_handle: `${src.handle}:${phase}`,
      errors: 1,
      error_detail: message,
      finished_at: new Date().toISOString(),
    });
    await logIngestError(admin, src.venue_id, phase, 'phase_failed', message, '');
    return Response.json({ ok: false, phase, venue: venueName, error: message }, { status: 500 });
  }
});
