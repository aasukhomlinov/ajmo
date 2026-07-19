// Universal venue parser (parse-venue).
//
// One function, per-source adapters, driven by `sources` rows the same way
// parse-dcloza is (kind 'official' | 'tickets' → HTML page, 'telegram' →
// t.me/s/<channel> preview). One Claude call per venue page extracts an
// ARRAY of events; validated events are inserted into `events` with the
// same dedup guard DC Loža relies on (events_dedup_idx unique index →
// 23505 treated as duplicate). Instagram is out of scope.
//
// Invoke with {"venue_id": "..."} (or ?venue_id=) for one venue, or with no
// args to run every enabled non-instagram source except dcloza (which keeps
// its own function). Returns a per-venue summary.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const TZ = 'Europe/Belgrade';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MAX_PAYLOAD_CHARS = 50_000;
const MAX_MONTHS_AHEAD = 12;

type Admin = ReturnType<typeof createClient>;

interface Source {
  id: string;
  kind: string;
  handle: string;
  url: string;
  city_id: string;
  venue_id: string;
  enabled: boolean;
}

interface ExtractedEvent {
  title: string;
  description: string | null;
  /** Belgrade local naive ISO: 'YYYY-MM-DDTHH:MM:SS' or 'YYYY-MM-DD'. */
  date_start: string;
  date_end: string | null;
  price_min_rsd: number | null;
  is_free: boolean | null;
  event_url: string | null;
  image_url: string | null;
  category: string | null;
}

interface VenueSummary {
  venue: string;
  handle: string;
  kind: string;
  fetched_bytes: number;
  payload_chars: number;
  events_extracted: number;
  events_upserted: number;
  duplicates: number;
  dropped_invalid: number;
  errors: string[];
  samples: unknown[];
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

// ── Adapters: source → text payload for the LLM ──────────────────────────────
/** Strip markup down to visible text. The LLM handles remaining noise. */
function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** t.me/s preview → one text block per post, with post date + cover URL inline. */
function telegramPayload(html: string, handle: string): string {
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
  // Newest posts only: t.me/s lists oldest→newest, and the gateway kills
  // responses at 150s — a full 20-post extraction blows that budget.
  // ponytail: fixed cap of 12; page through history if backfill ever matters.
  return posts.slice(-10).join('\n\n---\n\n');
}

// ── Claude extraction: one call per venue page, array of events ──────────────
// Plain-text strict JSON, not forced tool_use: tool grammars may \u-escape
// Cyrillic (6 ASCII chars per RU char), and Russian-channel extraction already
// runs ~110s — close to the platform's 150s wall clock. Text JSON keeps UTF-8
// raw; the post cap + max_tokens + fetch timeouts keep the run inside budget.
const OUTPUT_SPEC = `Respond with ONLY a JSON array — no prose, no markdown fences. Each element:
{
  "title": string,
  "description": string | null,        // ONE short sentence (max ~15 words) in the page's language
  "date_start": string,                // Belgrade local naive ISO 'YYYY-MM-DDTHH:MM:SS' (no offset); 'YYYY-MM-DD' when no time is stated (exhibitions)
  "date_end": string | null,           // same format; only for ranges (exhibitions/festivals)
  "price_min_rsd": number | null,      // minimum ticket price as plain number ("od 4.500,00 RSD" → 4500)
  "is_free": boolean | null,
  "event_url": string | null,
  "image_url": string | null,
  "category": "music" | "party" | "art" | "food" | "cinema" | "theatre" | "market" | "other" | null
}
Return [] if the page has no resolvable upcoming events.`;

/** Tolerant parse: model may still wrap the array in fences or a sentence. */
function parseEventsJson(text: string): ExtractedEvent[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) throw new Error(`no JSON array in response: ${text.slice(0, 200)}`);
  const parsed = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('response JSON is not an array');
  return parsed as ExtractedEvent[];
}

function systemPrompt(source: Source, venueName: string): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  return `You extract structured events from one venue's page as STRICT JSON (never prose). The venue is ALWAYS "${venueName}" (Belgrade); never extract other venues.

${OUTPUT_SPEC}

Today is ${today} (Europe/Belgrade).

RULES:
- DATES are usually in Serbian: "Ponedeljak, 20. jul 2026. u 20.00" → 2026-07-20T20:00:00; "05. oktobar 2026 20:00" → 2026-10-05T20:00:00; ranges "Od 27. maja do 31. avgusta 2026." are exhibitions → date_start=2026-05-27, date_end=2026-08-31, date-only (no time). English dates ("05 October 2026 20:00") work the same. Return Belgrade local naive ISO, NO timezone offset.
- SKIP any event whose date cannot be resolved. NEVER guess or hallucinate a date. Skip events already fully in the past (a range ending in the future is fine).
- DEDUPLICATE: pages often repeat the same event many times (calendar shows one exhibition on every day; ticketing pages duplicate their listings). Output each distinct event EXACTLY ONCE, using its full range when shown.
- PRICES: "Ulaznice od 4.500,00 RSD" / "od 2.500,00" → price_min_rsd: 4500 / 2500 (Serbian format: "." thousands, "," decimals). "donacija"/"донат" → price_min_rsd null, is_free false. Explicitly free → is_free true.
- IGNORE navigation, SEO keyword spam, "Ostala mesta u blizini" (nearby-venue) sections, and unrelated cities.
${source.kind === 'telegram'
    ? `- The input is a list of Telegram channel posts. Posts may omit the YEAR — infer it from the post's "published:" date (the event is on or shortly after it). Skip weekly schedule digests bundling many events, promos, and posts without a concrete event date. Use the post's image URL as image_url and the post URL as event_url.`
    : `- Set event_url / image_url only from URLs literally present in the text; null otherwise.`}
- CATEGORY: one of music, party, art, food, cinema, theatre, market, other. Exhibitions → "art", film → "cinema", concerts → "music", DJ/club → "party", ballet/opera/plays/talk-show-style stage shows → "theatre", lectures/games/workshops → "other". Null if truly unclear.
- description: ONE short sentence (max ~15 words) in the page's language, or null when the page gives nothing beyond the title. Be terse — this runs under a hard time budget.`;
}

async function extractEvents(
  source: Source,
  venueName: string,
  payload: string,
  apiKey: string,
): Promise<ExtractedEvent[]> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(125_000),
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096, // ponytail: output time is the 150s-wall-clock risk; raise if venues overflow
      system: systemPrompt(source, venueName),
      messages: [{ role: 'user', content: `VENUE PAGE (${source.url}):\n\n${payload}` }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('');
  if (data.stop_reason === 'max_tokens') throw new Error('extraction truncated at max_tokens');
  return parseEventsJson(text);
}

// ── Cover re-hosting (Telegram CDN URLs expire; same bucket as parse-dcloza) ─
const STORAGE_BUCKET = 'event-covers';

async function rehostCover(admin: Admin, key: string, sourceUrl: string): Promise<string> {
  // Telegram's CDN sometimes hangs from AWS IPs — a stuck fetch killed whole
  // runs (WORKER_RESOURCE_LIMIT). Bound it; on timeout the event keeps a null cover.
  const imgRes = await fetch(sourceUrl, { signal: AbortSignal.timeout(10_000) });
  if (!imgRes.ok) throw new Error(`cover download ${imgRes.status}`);
  const bytes = new Uint8Array(await imgRes.arrayBuffer());
  const { error } = await admin.storage.from(STORAGE_BUCKET).upload(key, bytes, {
    contentType: imgRes.headers.get('content-type') ?? 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return admin.storage.from(STORAGE_BUCKET).getPublicUrl(key).data.publicUrl;
}

// ── Per-venue pipeline ───────────────────────────────────────────────────────
async function parseVenue(admin: Admin, source: Source, anthropicKey: string): Promise<VenueSummary> {
  const { data: venue } = await admin
    .from('venues')
    .select('name')
    .eq('id', source.venue_id)
    .single();
  const summary: VenueSummary = {
    venue: venue?.name ?? source.handle,
    handle: source.handle,
    kind: source.kind,
    fetched_bytes: 0,
    payload_chars: 0,
    events_extracted: 0,
    events_upserted: 0,
    duplicates: 0,
    dropped_invalid: 0,
    errors: [],
    samples: [],
  };

  // 1. Fetch.
  const pageRes = await fetch(source.url, {
    headers: { 'user-agent': 'Mozilla/5.0 (ajmo parser)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!pageRes.ok) throw new Error(`fetch ${source.url} → ${pageRes.status}`);
  const html = await pageRes.text();
  summary.fetched_bytes = html.length;

  // 2. Pre-clean into an LLM payload, capped at 50k chars (truncate the tail).
  let payload = source.kind === 'telegram' ? telegramPayload(html, source.handle) : cleanHtml(html);
  payload = payload.slice(0, MAX_PAYLOAD_CHARS);
  summary.payload_chars = payload.length;
  if (!payload) throw new Error('empty payload after cleaning');

  // 3. Extract (one Claude call per venue page).
  const extracted = await extractEvents(source, summary.venue, payload, anthropicKey);
  summary.events_extracted = extracted.length;

  // 4. Validate + 5. Insert with dedup.
  const now = Date.now();
  const horizon = now + MAX_MONTHS_AHEAD * 30 * 24 * 3600 * 1000;
  const seen = new Set<string>(); // intra-run dedup; DB index guards across runs
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

    // Telegram covers live on an expiring CDN — re-host into our bucket.
    let coverUrl = ev.image_url ?? null;
    if (coverUrl && source.kind === 'telegram') {
      try {
        const msgId = ev.event_url?.match(/\/(\d+)$/)?.[1] ?? `${Date.parse(startsAt)}`;
        coverUrl = await rehostCover(admin, `${source.handle}/${msgId}.jpg`, coverUrl);
      } catch (e) {
        summary.errors.push(`cover ${ev.title}: ${e instanceof Error ? e.message : String(e)}`);
        coverUrl = null;
      }
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
      covers: coverUrl ? [coverUrl] : null,
      source_type: source.kind === 'telegram' ? 'telegram' : 'website',
      source_url: ev.event_url ?? source.url,
      status: 'published',
    });
    if (insErr) {
      if (insErr.code === '23505') {
        summary.duplicates += 1; // events_dedup_idx: already ingested on a prior run
        continue;
      }
      summary.errors.push(`insert ${ev.title}: ${insErr.message}`);
      continue;
    }
    summary.events_upserted += 1;
    if (summary.samples.length < 5) {
      summary.samples.push({
        title: ev.title,
        starts_at_belgrade: ev.date_start,
        ends_at_belgrade: ev.date_end,
        price_min_rsd: ev.price_min_rsd,
        is_free: ev.is_free,
        category: ev.category,
        event_url: ev.event_url,
        cover: coverUrl,
      });
    }
  }

  await admin.from('sources').update({ last_run_at: new Date().toISOString() }).eq('id', source.id);
  await admin.from('ingest_runs').insert({
    source_handle: source.handle,
    found: summary.events_extracted,
    inserted: summary.events_upserted,
    skipped_nonevents: summary.dropped_invalid,
    errors: summary.errors.length,
    error_detail: summary.errors.length ? summary.errors.join(' | ') : null,
    finished_at: new Date().toISOString(),
  });
  return summary;
}

// ── Handler ──────────────────────────────────────────────────────────────────
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
  const venueId = body?.venue_id ?? new URL(req.url).searchParams.get('venue_id');

  let query = admin
    .from('sources')
    .select('id, kind, handle, url, city_id, venue_id, enabled')
    .eq('enabled', true)
    .neq('handle', 'dcloza') // dcloza keeps its own function
    .in('kind', ['telegram', 'official', 'tickets']); // no instagram
  if (venueId) query = query.eq('venue_id', venueId);

  const { data: sources, error: srcErr } = await query;
  if (srcErr) return Response.json({ ok: false, error: srcErr.message }, { status: 500 });
  if (!sources?.length) {
    return Response.json({ ok: false, error: `no enabled sources${venueId ? ` for venue ${venueId}` : ''}` }, { status: 404 });
  }

  // One broken venue must not kill the batch.
  const results: VenueSummary[] = [];
  for (const source of sources as Source[]) {
    try {
      results.push(await parseVenue(admin, source, anthropicKey));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({
        venue: source.handle, handle: source.handle, kind: source.kind,
        fetched_bytes: 0, payload_chars: 0, events_extracted: 0, events_upserted: 0,
        duplicates: 0, dropped_invalid: 0, errors: [message], samples: [],
      });
      await admin.from('ingest_runs').insert({
        source_handle: source.handle,
        errors: 1,
        error_detail: message,
        finished_at: new Date().toISOString(),
      });
    }
  }

  return Response.json({ ok: results.every((r) => r.errors.length === 0), venues: results });
});
