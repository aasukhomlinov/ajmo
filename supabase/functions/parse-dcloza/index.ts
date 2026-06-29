// DC Loża Telegram parser (Phase 5, session 2).
//
// Fetches the public preview page https://t.me/s/dcloza (HTML, no API key),
// extracts recent posts, and for each one asks Claude (Haiku) to pull a single
// structured event — multilingual (en/ru/sr) — which we insert into `events`.
//
// Source is driven by the `sources` row (handle 'dcloza' → venue DC Loża,
// Belgrade). Writes go through the service role (RLS bypass). Each run is logged
// to `ingest_runs`.
//
// Notes from the real feed:
//  - posts are emoji-labelled (💸 price, 📅 date, 🕕 time, 📍 location);
//  - each language is its OWN post (a RU post + a separate EN post for the same
//    event) and the two can disagree on the start time, so beyond source_ref and
//    the (venue, starts_at, lower(title)) index we run a FUZZY dedup: same venue,
//    same Belgrade day, ±90 min, overlapping title in any language → merge, don't
//    duplicate (see the fuzzy-dedup section);
//  - some posts have no image; weekly "schedule" digests bundle many events and
//    must be skipped.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const TELEGRAM_TZ = 'Europe/Belgrade';
const ANTHROPIC_MODEL = 'claude-haiku-4-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const PUBLISH_CONFIDENCE = 0.8;

type Lang = 'en' | 'ru' | 'sr';
type Localized = Record<Lang, string | null>;

interface ParsedPost {
  messageId: number;
  /** Post publish time (ISO, from the page) — used to infer the event year. */
  postedAt: string | null;
  coverUrl: string | null;
  text: string;
}

interface Extraction {
  is_event: boolean;
  is_digest: boolean;
  title_i18n: Localized;
  description_i18n: Localized;
  /** Belgrade local wall-clock, naive ISO 'YYYY-MM-DDTHH:MM:SS' (no offset), or null. */
  starts_at_local: string | null;
  price_text: string | null;
  is_free: boolean;
  category: string;
  confidence: number;
}

// ── HTML parsing ─────────────────────────────────────────────────────────────
// The t.me/s page is regular markup; regex avoids a DOM/WASM dependency in the
// edge runtime. Each post is a `.tgme_widget_message` div with a data-post id.
function parsePosts(html: string): ParsedPost[] {
  const blocks = html.split(/(?=<div class="tgme_widget_message[^"]*?" data-post="dcloza\/)/);
  const posts: ParsedPost[] = [];

  for (const block of blocks) {
    const idMatch = block.match(/data-post="dcloza\/(\d+)"/);
    if (!idMatch) continue;
    const messageId = Number(idMatch[1]);

    const dateMatch = block.match(/<time[^>]*datetime="([^"]+)"/);

    // Cover: only the photo wrapper's background-image (emoji also use one).
    const photoMatch = block.match(
      /tgme_widget_message_photo_wrap[^>]*?background-image:url\('([^']+)'\)/,
    );

    const textMatch = block.match(
      /<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>/,
    );
    let text = '';
    if (textMatch) {
      text = textMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '') // strip tags; emoji chars sit in <b> and survive
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
    }

    posts.push({
      messageId,
      postedAt: dateMatch ? dateMatch[1] : null,
      coverUrl: photoMatch ? photoMatch[1] : null,
      text,
    });
  }

  // Oldest first: for a RU/EN pair the earlier post wins the (venue, time) dedup.
  posts.sort((a, b) => a.messageId - b.messageId);
  return posts;
}

// ── Timezone ─────────────────────────────────────────────────────────────────
// Convert a naive Belgrade wall-clock string to a UTC instant, DST-correct.
function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(instant);
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

function belgradeLocalToInstant(localISO: string): string | null {
  const m = localISO.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const naiveUTC = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
  // One-pass offset resolution (good away from the rare DST-boundary minute).
  const offset = tzOffsetMinutes(new Date(naiveUTC), TELEGRAM_TZ);
  return new Date(naiveUTC - offset * 60000).toISOString();
}

// ── Fuzzy cross-language dedup ────────────────────────────────────────────────
// The same event is posted once per language (RU + EN), and the two posts can
// extract slightly different start times ("gathering" 16:00 vs "start" 16:30).
// Exact (venue, starts_at, title) misses that, so we additionally collapse posts
// at the same venue on the same Belgrade day, within ±90 min, with overlapping
// titles in ANY language pair.
const DEDUP_WINDOW_MIN = 90; // outer band: dedup only with a title match
const SAME_SLOT_MIN = 5; // same start slot at one venue ⇒ same event, title aside

interface ExistingEvent {
  id: string;
  source_ref: string | null;
  starts_at: string;
  title: string;
  title_i18n: Record<string, string> | null;
  description_i18n: Record<string, string> | null;
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\p{Extended_Pictographic}]/gu, '') // strip emoji
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (short.length >= 8 && long.startsWith(short)) return true; // "...serbia" ⊂ "...serbia 25 years later"
  const sa = new Set(na.split(' '));
  const sb = new Set(nb.split(' '));
  const inter = [...sa].filter((t) => sb.has(t)).length;
  const union = new Set([...sa, ...sb]).size;
  return union > 0 && inter / union >= 0.75;
}

function existingTitleStrings(e: ExistingEvent): string[] {
  return [...Object.values(e.title_i18n ?? {}), e.title].filter(Boolean) as string[];
}

function titlesOverlap(a: string[], b: string[]): boolean {
  for (const x of a) for (const y of b) if (titlesMatch(x, y)) return true;
  return false;
}

function belgradeDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TELEGRAM_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/**
 * Is `newStart`/`newTitles` the same event as existing row `e`? Same venue is
 * already guaranteed by the query. Same Belgrade day, then either the same start
 * slot (≤5 min apart — a RU/EN pair that agrees on the time, regardless of how
 * the titles were phrased) or a title overlap within ±90 min (a pair that
 * disagreed on the time, e.g. "gathering" 16:00 vs "start" 16:30).
 */
function isSameEvent(newStart: string, newTitles: string[], e: ExistingEvent): boolean {
  if (belgradeDay(newStart) !== belgradeDay(e.starts_at)) return false;
  const deltaMin = Math.abs(Date.parse(newStart) - Date.parse(e.starts_at)) / 60000;
  if (deltaMin > DEDUP_WINDOW_MIN) return false;
  if (deltaMin <= SAME_SLOT_MIN) return true;
  return titlesOverlap(newTitles, existingTitleStrings(e));
}

/** Fill any language slot the existing row is missing from the new post. Mutates `dup`. */
function mergeLanguages(
  dup: ExistingEvent,
  titleI18n: Record<string, string>,
  descI18n: Record<string, string>,
): string[] {
  const filled: string[] = [];
  const t = { ...(dup.title_i18n ?? {}) };
  const d = { ...(dup.description_i18n ?? {}) };
  for (const k of ['en', 'ru', 'sr'] as const) {
    if (!t[k] && titleI18n[k]) {
      t[k] = titleI18n[k];
      filled.push(`title.${k}`);
    }
    if (!d[k] && descI18n[k]) {
      d[k] = descI18n[k];
      filled.push(`description.${k}`);
    }
  }
  dup.title_i18n = t;
  dup.description_i18n = d;
  return filled;
}

// ── Claude extraction ────────────────────────────────────────────────────────
const EXTRACT_TOOL = {
  name: 'record_post',
  description: 'Record the structured extraction of a single Telegram post from a venue channel.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      is_event: {
        type: 'boolean',
        description: 'True if this post announces a single concrete event with a date.',
      },
      is_digest: {
        type: 'boolean',
        description: 'True if this is a weekly/schedule digest bundling MANY events (not a single announcement).',
      },
      title_i18n: {
        type: 'object',
        additionalProperties: false,
        properties: {
          en: { type: ['string', 'null'] },
          ru: { type: ['string', 'null'] },
          sr: { type: ['string', 'null'] },
        },
        required: ['en', 'ru', 'sr'],
      },
      description_i18n: {
        type: 'object',
        additionalProperties: false,
        properties: {
          en: { type: ['string', 'null'] },
          ru: { type: ['string', 'null'] },
          sr: { type: ['string', 'null'] },
        },
        required: ['en', 'ru', 'sr'],
      },
      starts_at_local: {
        type: ['string', 'null'],
        description: "Event start in Belgrade local time as naive ISO 'YYYY-MM-DDTHH:MM:SS' (NO timezone offset). Null if no date/time.",
      },
      price_text: {
        type: ['string', 'null'],
        description: 'Human price as written, e.g. "500 RSD". Use "donation" for donation-based entry. Null if unstated.',
      },
      is_free: { type: 'boolean' },
      category: {
        type: 'string',
        enum: ['music', 'party', 'art', 'food', 'cinema', 'theatre', 'market', 'other'],
      },
      confidence: { type: 'number', description: 'Extraction confidence 0..1.' },
    },
    required: [
      'is_event',
      'is_digest',
      'title_i18n',
      'description_i18n',
      'starts_at_local',
      'price_text',
      'is_free',
      'category',
      'confidence',
    ],
  },
} as const;

const SYSTEM_PROMPT = `You extract a single event from one Telegram post by the Belgrade venue "DC Loża" and return it via the record_post tool. The venue is ALWAYS DC Loża — never extract a venue.

Posts are emoji-labelled: 💸 price, 📅 date, 🕕 time, 👅 language, 📍 location. They are written in Russian and/or English (sometimes Serbian).

RULES:
- DIGESTS: if the post is a weekly "schedule"/"расписание" that bundles MANY events, set is_digest=true, is_event=false, and leave the content fields null. Only single-event announcements become events.
- NON-EVENTS: promos, reposts, reminders without a concrete date → is_event=false.
- DATE/TIME: read 📅 and 🕕. Posts omit the YEAR — infer it from the post's publish date (the event is on or shortly after the post date). Return starts_at_local as Belgrade local naive ISO 'YYYY-MM-DDTHH:MM:SS' with NO offset. If a post lists multiple start times (a programme), use the FIRST/headline start time.
- TITLE translation: translate the title into all three languages ONLY when it is a DESCRIPTIVE phrase written in Cyrillic (e.g. RU "Вечер настольных игр" → EN "Board games night", SR "Veče društvenih igara"). Otherwise keep the title verbatim and IDENTICAL across en/ru/sr:
  • PROPER NOUN (band, artist, brand, project name): keep it EXACTLY the same in all three, even in Cyrillic; do NOT translate or transliterate ("Психея" stays "Психея" in en/ru/sr).
  • LATIN-SCRIPT title (e.g. "Between Dogs and Dolls"): keep it EXACTLY as-is and IDENTICAL in all three (en = ru = sr = the Latin original), EVEN IF the post also provides a Cyrillic rendering of that title — ignore the Cyrillic form for the title field and use the Latin original in all three.
  For mixed titles, translate the descriptive Cyrillic parts and keep proper-noun / Latin-script parts verbatim.
- DESCRIPTION: ALWAYS provide all three languages — translate from whatever language(s) the post has into the missing ones. Keep it concise (1–3 sentences), capturing what the event is.
- PRICE: "донат"/"donation"/"рекомендованный донат"/"любой донат" → price_text="donation", is_free=false (it is not free; the amount is flexible). A concrete amount like "500 RSD" → that text, is_free=false. Explicitly free → is_free=true.
- CATEGORY: map to one of music, party, art, food, cinema, theatre, market, other. Lectures, talks, games nights, tea ceremonies, workshops → "other". Film screenings → "cinema". DJ/club nights → "party". Concerts/live music → "music".
- confidence: lower it when the date, title, or nature of the event is unclear.`;

interface Usage {
  input_tokens?: number;
  output_tokens?: number;
}

async function extract(
  post: ParsedPost,
  apiKey: string,
): Promise<{ data: Extraction; usage: Usage }> {
  const userText = `POST published at: ${post.postedAt ?? 'unknown'}\nVenue: DC Loża (Belgrade)\n\nPOST TEXT:\n${post.text}`;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'tool', name: 'record_post' },
      messages: [{ role: 'user', content: userText }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const toolUse = (data.content ?? []).find(
    (b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'record_post',
  );
  if (!toolUse) throw new Error('No tool_use block in Anthropic response');
  return { data: toolUse.input as Extraction, usage: (data.usage ?? {}) as Usage };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function canonical(loc: Localized): string {
  return loc.en || loc.ru || loc.sr || '';
}

/** Drop null-valued languages so we store a compact {lang: text} object. */
function compact(loc: Localized): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(loc)) if (v) out[k] = v;
  return out;
}

const STORAGE_BUCKET = 'event-covers';
const PUBLIC_OBJECT_MARKER = '/storage/v1/object/public/';

/**
 * Download a Telegram cover and re-host it in Supabase Storage, returning the
 * durable public URL. Telegram CDN URLs (cdn*.telesco.pe) aren't permanent, so
 * covers we keep must live in our own bucket.
 *
 * Idempotent: an already-rehosted Supabase URL is returned untouched, and the
 * upload upserts a stable key (dcloza/<messageId>.jpg). Throws on download /
 * upload failure so the caller can log it and fall back to a null cover.
 */
async function rehostCover(
  admin: ReturnType<typeof createClient>,
  messageId: number,
  sourceUrl: string | null,
): Promise<string | null> {
  if (!sourceUrl) return null;
  if (sourceUrl.includes(PUBLIC_OBJECT_MARKER)) return sourceUrl; // already in our bucket

  const key = `dcloza/${messageId}.jpg`;
  const imgRes = await fetch(sourceUrl);
  if (!imgRes.ok) throw new Error(`cover download ${imgRes.status}`);
  const bytes = new Uint8Array(await imgRes.arrayBuffer());

  const { error } = await admin.storage.from(STORAGE_BUCKET).upload(key, bytes, {
    contentType: imgRes.headers.get('content-type') ?? 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;

  return admin.storage.from(STORAGE_BUCKET).getPublicUrl(key).data.publicUrl;
}

/**
 * One-off maintenance: re-host the covers of events already in the DB whose cover
 * still points at Telegram's CDN. Image fetch + upload only — no Claude calls.
 * Idempotent (skips covers already in our bucket).
 */
async function rehostExistingCovers(admin: ReturnType<typeof createClient>): Promise<Response> {
  const { data: source } = await admin
    .from('sources')
    .select('venue_id')
    .eq('handle', 'dcloza')
    .single();
  if (!source) {
    return Response.json({ ok: false, error: "source 'dcloza' not found" }, { status: 500 });
  }

  const { data: rows } = await admin
    .from('events')
    .select('id, source_ref, covers')
    .eq('venue_id', source.venue_id);

  let rehosted = 0;
  let skipped = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const ev of rows ?? []) {
    const current: string | null = ev.covers?.[0] ?? null;
    if (!current || current.includes(PUBLIC_OBJECT_MARKER)) {
      skipped += 1; // no cover, or already in our bucket
      continue;
    }
    const messageId = Number(String(ev.source_ref ?? '').replace('dcloza:', ''));
    try {
      const url = await rehostCover(admin, messageId, current);
      if (!url) {
        skipped += 1;
        continue;
      }
      await admin.from('events').update({ covers: [url] }).eq('id', ev.id);
      rehosted += 1;
    } catch (e) {
      failed += 1;
      failures.push(`${ev.source_ref}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await admin.from('ingest_runs').insert({
    source_handle: 'dcloza-rehost',
    found: (rows ?? []).length,
    inserted: rehosted,
    errors: failed,
    error_detail: failures.length ? failures.join(' | ') : null,
    finished_at: new Date().toISOString(),
  });

  return Response.json({
    ok: true,
    mode: 'rehost',
    total: (rows ?? []).length,
    rehosted,
    skipped,
    failed,
    failures,
  });
}

// ── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Cost controls for testing: ?only=<messageId> processes exactly that post
  // (one Claude call); ?limit=<n> processes the newest n posts. Default: all.
  const params = new URL(req.url).searchParams;
  const onlyId = params.get('only');
  const limit = params.get('limit');
  const rehostMode = params.has('rehost');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Maintenance mode: re-host existing covers off Telegram CDN (no Claude calls).
  if (rehostMode) return await rehostExistingCovers(admin);

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const counters = {
    found: 0,
    inserted: 0,
    skipped_digests: 0,
    skipped_nonevents: 0,
    drafts: 0,
    errors: 0,
  };
  const errorDetails: string[] = [];
  const samples: unknown[] = [];

  if (!anthropicKey) {
    await admin.from('ingest_runs').insert({
      source_handle: 'dcloza',
      errors: 1,
      error_detail: 'ANTHROPIC_API_KEY secret not set',
      finished_at: new Date().toISOString(),
    });
    return Response.json(
      { ok: false, error: 'ANTHROPIC_API_KEY secret not set (supabase secrets set ANTHROPIC_API_KEY=...)' },
      { status: 500 },
    );
  }

  try {
    // 1. Resolve the source row.
    const { data: source, error: srcErr } = await admin
      .from('sources')
      .select('handle, url, city_id, venue_id, enabled')
      .eq('handle', 'dcloza')
      .single();
    if (srcErr || !source) throw new Error(`source 'dcloza' not found: ${srcErr?.message}`);
    if (!source.enabled) return Response.json({ ok: true, skipped: 'source disabled' });

    // 2. Fetch + parse the channel page.
    const pageRes = await fetch(source.url ?? 'https://t.me/s/dcloza', {
      headers: { 'user-agent': 'Mozilla/5.0 (ajmo parser)' },
    });
    if (!pageRes.ok) throw new Error(`t.me fetch ${pageRes.status}`);
    const allPosts = parsePosts(await pageRes.text());
    // Narrow the work for cost-controlled test runs (posts are oldest-first).
    let posts = allPosts;
    if (onlyId) posts = allPosts.filter((p) => p.messageId === Number(onlyId));
    else if (limit) posts = allPosts.slice(-Number(limit));
    counters.found = posts.length;

    // 3. Existing events for this venue → exact (source_ref) + fuzzy dedup inputs.
    const { data: existing } = await admin
      .from('events')
      .select('id, source_ref, starts_at, title, title_i18n, description_i18n')
      .eq('venue_id', source.venue_id);
    const existingEvents = (existing ?? []) as ExistingEvent[];
    const ingestedRefs = new Set(existingEvents.map((e) => e.source_ref).filter(Boolean));
    const deduped: unknown[] = [];

    // 4. Process each post.
    for (const post of posts) {
      const sourceRef = `dcloza:${post.messageId}`;
      if (ingestedRefs.has(sourceRef)) continue; // already ingested this message
      if (!post.text) {
        counters.skipped_nonevents += 1;
        continue;
      }

      let ex: Extraction;
      let usage: Usage;
      try {
        const out = await extract(post, anthropicKey);
        ex = out.data;
        usage = out.usage;
      } catch (e) {
        counters.errors += 1;
        errorDetails.push(`#${post.messageId}: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }

      if (ex.is_digest) {
        counters.skipped_digests += 1;
        continue;
      }
      if (!ex.is_event || !ex.starts_at_local) {
        counters.skipped_nonevents += 1;
        continue;
      }

      const startsAt = belgradeLocalToInstant(ex.starts_at_local);
      if (!startsAt) {
        counters.skipped_nonevents += 1;
        continue;
      }

      const titleI18n = compact(ex.title_i18n);
      const descI18n = compact(ex.description_i18n);

      // Fuzzy cross-language dedup: same day, ±90 min, overlapping title in any
      // language. On a hit, merge missing languages into the existing row.
      const newTitles = [...Object.values(titleI18n), canonical(ex.title_i18n)].filter(Boolean);
      const dup = existingEvents.find((e) => isSameEvent(startsAt, newTitles, e));
      if (dup) {
        const filled = mergeLanguages(dup, titleI18n, descI18n);
        if (filled.length) {
          await admin
            .from('events')
            .update({ title_i18n: dup.title_i18n, description_i18n: dup.description_i18n })
            .eq('id', dup.id);
        }
        deduped.push({ source_ref: sourceRef, merged_into: dup.id, filled });
        continue;
      }

      // Re-host the cover into Supabase Storage so it doesn't depend on Telegram's
      // CDN. On failure keep the event with a null cover (don't fail the run).
      let coverUrl: string | null = null;
      if (post.coverUrl) {
        try {
          coverUrl = await rehostCover(admin, post.messageId, post.coverUrl);
        } catch (e) {
          errorDetails.push(`#${post.messageId} cover: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      const status = ex.confidence < PUBLISH_CONFIDENCE ? 'draft' : 'published';

      const { data: insertedRow, error: insErr } = await admin
        .from('events')
        .insert({
          city_id: source.city_id,
          venue_id: source.venue_id,
          title: canonical(ex.title_i18n),
          description: canonical(ex.description_i18n) || null,
          title_i18n: Object.keys(titleI18n).length ? titleI18n : null,
          description_i18n: Object.keys(descI18n).length ? descI18n : null,
          category: ex.category,
          starts_at: startsAt,
          price_text: ex.price_text,
          is_free: ex.is_free,
          covers: coverUrl ? [coverUrl] : null,
          source_type: 'telegram',
          source_url: `https://t.me/dcloza/${post.messageId}`,
          source_ref: sourceRef,
          status,
        })
        .select('id')
        .single();

      if (insErr) {
        // 23505 = unique violation (source_ref or the dedup index) → treat as dup.
        if (insErr.code === '23505') continue;
        counters.errors += 1;
        errorDetails.push(`#${post.messageId} insert: ${insErr.message}`);
        continue;
      }

      counters.inserted += 1;
      if (status === 'draft') counters.drafts += 1;
      ingestedRefs.add(sourceRef);
      // Make this insert visible to later posts in the same run (intra-run dedup).
      existingEvents.push({
        id: insertedRow!.id,
        source_ref: sourceRef,
        starts_at: startsAt,
        title: canonical(ex.title_i18n),
        title_i18n: titleI18n,
        description_i18n: descI18n,
      });
      if (samples.length < 3) {
        samples.push({
          source_ref: sourceRef,
          source_url: `https://t.me/dcloza/${post.messageId}`,
          status,
          is_event: ex.is_event,
          is_digest: ex.is_digest,
          category: ex.category,
          starts_at: startsAt,
          starts_at_belgrade: ex.starts_at_local,
          price_text: ex.price_text,
          is_free: ex.is_free,
          confidence: ex.confidence,
          cover_url: coverUrl,
          title_i18n: ex.title_i18n,
          description_i18n: ex.description_i18n,
          post_text: post.text,
          usage,
        });
      }
    }

    await admin
      .from('sources')
      .update({ last_run_at: new Date().toISOString() })
      .eq('handle', 'dcloza');

    await admin.from('ingest_runs').insert({
      source_handle: 'dcloza',
      ...counters,
      error_detail: errorDetails.length ? errorDetails.join(' | ') : null,
      finished_at: new Date().toISOString(),
    });

    return Response.json({ ok: true, ...counters, deduped, samples });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from('ingest_runs').insert({
      source_handle: 'dcloza',
      ...counters,
      errors: counters.errors + 1,
      error_detail: [message, ...errorDetails].join(' | '),
      finished_at: new Date().toISOString(),
    });
    return Response.json({ ok: false, error: message, ...counters }, { status: 500 });
  }
});
