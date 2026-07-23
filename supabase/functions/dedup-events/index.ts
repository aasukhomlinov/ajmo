// dedup-events — post-translate duplicate reconciliation.
//
// Insert-time dedup (parse-venue) is cheap and runs BEFORE translate, so a
// reworded / cross-script / cross-language repost of an already-catalogued
// event can slip past it (the fleet-run + organizer-canary failure mode:
// same event, two independently written posts). This function sweeps the
// live catalogue AFTER translate — when title_i18n exists and covers are
// re-hosted — and merges what it can prove:
//
//   gate     same venue, both published, |Δstarts_at| ≤ 6h (parse-venue's
//            window, kept identical on purpose)
//   signals  title similarity (max over source/en/sr titles, transliterated
//            + diacritic-folded), cover dHash distance, time proximity,
//            category, price
//   decide   AUTO-merge on strong title evidence (t ≥ 0.7 + same category,
//            or t ≥ 0.9) unless covers actively contradict; a GREY band gets
//            one cheap Haiku adjudication per pair (capped per run, every
//            verdict logged in the response); everything else stays distinct.
//            Midnight-midnight pairs (date-only events) never count time
//            proximity — exhibitions all "start" at 00:00.
//   merge    merge_event_pair() RPC (transactional): survivor = earliest
//            created_at, loser backed up to _dedup_merges, saves/reminders
//            moved, missing fields carried over, and source_items.event_refs
//            repointed (or the survivor ADOPTS the loser's source_ref) so
//            the ledger's skip-check keeps passing — without the repoint the
//            next sweep re-extracts the merged item into a fresh twin.
//
// Cover dHashes are computed here, once per image (events.cover_hash, with
// cover_hash_src as staleness marker) — storage-hosted covers only; raw CDN
// links rotate and expire, they get hashed after phase `covers` re-hosts.
//
// Invoke: POST {} sweeps the whole catalogue. Optional body:
//   { dry_run: true }                    score + report only: no merges, no LLM
//   { venue_id: "…" }                    one venue
//   { max_merges: 20, max_adjudications: 20 }
//   { adjudicate_only: [["<id>","<id>"], …] }   verdicts only, never merges

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { dhashUrl, hamming } from '../_shared/cover-hash.ts';
import { SAME_EVENT_WINDOW_MS, titleSimilarity } from '../_shared/similarity.ts';

const HAIKU_MODEL = 'claude-haiku-4-5'; // same tier as translate; pairs are rare
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const PUBLIC_OBJECT_MARKER = '/storage/v1/object/public/';
const TZ = 'Europe/Belgrade';
const TIME_BUDGET_MS = 100_000;

// Decision thresholds — calibrated on the 2026-07-23 fixture sets (six known
// duplicate pairs vs festival sub-events / midnight date-only neighbours /
// repertoire double-bills that must stay distinct).
const AUTO_TITLE = 0.7; //       … + same category
const AUTO_TITLE_SOLO = 0.9; //  title evidence alone
const GREY_SCORE = 0.45;
const GREY_TITLE = 0.4;
const COVER_SAME = 6; //   dHash hamming ≤ → same poster
const COVER_NEAR = 10;
const COVER_CONTRA = 20; // ≥ → actively different posters: blocks AUTO
const ADJUDICATE_MIN_CONFIDENCE = 0.7;
// JPEG decode is CPU-bound and edge workers enforce a compute cap (a ~250-
// image backfill died with WORKER_RESOURCE_LIMIT). Normal load is ~0: phase
// `covers` hashes at rehost time; this is only the backstop for stragglers.
const MAX_HASHES_PER_RUN = 8;

type Admin = ReturnType<typeof createClient>;

interface Ev {
  id: string;
  venue_id: string;
  title: string;
  title_i18n: Record<string, string> | null;
  description: string | null;
  description_i18n: Record<string, string> | null;
  starts_at: string;
  ends_at: string | null;
  category: string;
  price_text: string | null;
  is_free: boolean;
  covers: string[] | null;
  cover_hash: string | null;
  cover_hash_src: string | null;
  source_ref: string | null;
  created_at: string;
}

const EV_COLS =
  'id, venue_id, title, title_i18n, description, description_i18n, starts_at, ends_at, ' +
  'category, price_text, is_free, covers, cover_hash, cover_hash_src, source_ref, created_at';

// ── Scoring ──────────────────────────────────────────────────────────────────
function isMidnightLocal(iso: string): boolean {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso)) === '00:00';
}

function pairTitleSim(a: Ev, b: Ev, venueName: string): number {
  const variants: [string | undefined, string | undefined][] = [
    [a.title, b.title],
    [a.title_i18n?.en, b.title_i18n?.en],
    [a.title_i18n?.sr, b.title_i18n?.sr],
  ];
  let best = 0;
  for (const [x, y] of variants) if (x && y) best = Math.max(best, titleSimilarity(x, y, venueName));
  return best;
}

interface Pair {
  a: Ev;
  b: Ev;
  venueName: string;
  t: number;
  coverDist: number | null;
  cover: 'same' | 'near' | 'far' | 'unknown';
  exactInstant: boolean;
  bothMidnight: boolean;
  catEq: boolean;
  score: number;
  decision: 'auto' | 'grey' | 'no';
}

function scorePair(a: Ev, b: Ev, venueName: string): Pair {
  const t = pairTitleSim(a, b, venueName);
  const dt = Math.abs(Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const bothMidnight = isMidnightLocal(a.starts_at) && isMidnightLocal(b.starts_at);
  const exactInstant = dt === 0 && !bothMidnight;

  let coverDist: number | null = null;
  let cover: Pair['cover'] = 'unknown';
  if (a.cover_hash && b.cover_hash) {
    coverDist = hamming(a.cover_hash, b.cover_hash);
    cover = coverDist <= COVER_SAME ? 'same' : coverDist <= COVER_NEAR ? 'near' : 'far';
  }
  const contra = coverDist !== null && coverDist >= COVER_CONTRA;

  const catEq = a.category === b.category;
  const cCover = cover === 'same' ? 1 : cover === 'near' ? 0.5 : 0;
  const cTime = bothMidnight ? 0 : 1 - dt / SAME_EVENT_WINDOW_MS;
  const cCat = catEq ? (a.category === 'other' ? 0.5 : 1) : 0;
  const cPrice = a.price_text && b.price_text
    ? (a.price_text === b.price_text ? 1 : 0)
    : !a.price_text && !b.price_text ? 0.5 : 0.25;
  const score = 0.45 * t + 0.25 * cCover + 0.15 * cTime + 0.075 * cCat + 0.075 * cPrice;

  // AUTO needs real title evidence — cover/time/category alone can never
  // auto-merge (festival sub-events share posters and instants). GREY is
  // deliberately wide: adjudication is cheap and capped.
  const auto = !contra && ((t >= AUTO_TITLE && catEq) || t >= AUTO_TITLE_SOLO);
  const grey = !auto &&
    (score >= GREY_SCORE || t >= GREY_TITLE || (exactInstant && catEq) || cover === 'same');

  return {
    a, b, venueName, t, coverDist, cover, exactInstant, bothMidnight, catEq, score,
    decision: auto ? 'auto' : grey ? 'grey' : 'no',
  };
}

// ── Haiku adjudication (grey band) ───────────────────────────────────────────
const ADJUDICATE_SYSTEM = `You judge whether two catalogue entries describe the SAME single real-world event (a duplicate to merge) or DISTINCT events. Both are at the same venue.
Rules:
- A reworded repost of ONE happening = SAME: headliner-only title vs full-lineup title, hashtag vs prose, Cyrillic vs Latin script, different language, organizer's post vs venue's post.
- A festival/programme UMBRELLA entry vs one of its sub-events = DISTINCT.
- Different acts, lineups, films or activities at the same venue and time (double-bill, repertoire day) = DISTINCT.
- A recurring series/format on different content = DISTINCT.
- When genuinely unsure, same_event = false.
Respond with ONLY strict JSON: {"same_event": true|false, "confidence": <0..1>, "reason": "<one short sentence>"}`;

function belgradeLocal(iso: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ, dateStyle: 'short', timeStyle: 'short',
  }).format(new Date(iso));
}

interface Verdict {
  same_event: boolean;
  confidence: number;
  reason: string;
}

async function adjudicate(apiKey: string, a: Ev, b: Ev, venueName: string): Promise<Verdict> {
  const one = (e: Ev) => ({
    title: e.title,
    title_en: e.title_i18n?.en ?? null,
    description: (e.description ?? e.description_i18n?.en ?? '').slice(0, 500) || null,
    starts_at_local: belgradeLocal(e.starts_at),
    ends_at_local: e.ends_at ? belgradeLocal(e.ends_at) : null,
    category: e.category,
    price: e.price_text,
    is_free: e.is_free,
  });
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 300,
      system: ADJUDICATE_SYSTEM,
      messages: [{
        role: 'user',
        content: JSON.stringify({ venue: venueName, event_A: one(a), event_B: one(b) }),
      }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((x: { type: string }) => x.type === 'text')
    .map((x: { text: string }) => x.text)
    .join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`no JSON in verdict: ${text.slice(0, 120)}`);
  const v = JSON.parse(m[0]);
  return {
    same_event: v.same_event === true,
    confidence: Number(v.confidence) || 0,
    reason: String(v.reason ?? ''),
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const t0 = Date.now();
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  ) as Admin;
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;
  const venueId = (body?.venue_id as string) ?? null;
  const maxMerges = Number(body?.max_merges ?? 20);
  const maxAdjudications = Number(body?.max_adjudications ?? 20);
  const adjudicateOnly: string[][] | null =
    Array.isArray(body?.adjudicate_only) ? body.adjudicate_only : null;

  const errors: string[] = [];
  try {
    const { data: vRows, error: vErr } = await admin.from('venues').select('id, name');
    if (vErr) throw new Error(vErr.message);
    const venueNames = new Map(
      ((vRows ?? []) as { id: string; name: string }[]).map((v) => [v.id, v.name]),
    );

    // Manual verdicts on explicit pairs (e.g. suspected double-bills the
    // sweep must NOT silently merge) — reports only, never merges.
    if (adjudicateOnly) {
      if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY secret not set');
      const ids = [...new Set(adjudicateOnly.flat())];
      const { data, error } = await admin.from('events').select(EV_COLS).in('id', ids);
      if (error) throw new Error(error.message);
      const byId = new Map(((data ?? []) as unknown as Ev[]).map((e) => [e.id, e]));
      const verdicts: unknown[] = [];
      for (const [ia, ib] of adjudicateOnly) {
        const a = byId.get(ia);
        const b = byId.get(ib);
        if (!a || !b) {
          verdicts.push({ a: ia, b: ib, error: 'event not found' });
          continue;
        }
        try {
          verdicts.push({
            a: ia, b: ib, title_a: a.title, title_b: b.title,
            verdict: await adjudicate(anthropicKey, a, b, venueNames.get(a.venue_id) ?? ''),
          });
        } catch (e) {
          verdicts.push({ a: ia, b: ib, error: e instanceof Error ? e.message : String(e) });
        }
      }
      return Response.json({ ok: true, mode: 'adjudicate_only', verdicts });
    }

    // 1) live catalogue (past events have no dedup value)
    let q = admin.from('events').select(EV_COLS)
      .eq('status', 'published')
      .gte('starts_at', new Date(Date.now() - 24 * 3600_000).toISOString());
    if (venueId) q = q.eq('venue_id', venueId);
    const { data: eRows, error: eErr } = await q;
    if (eErr) throw new Error(eErr.message);
    const events = (eRows ?? []) as unknown as Ev[];

    // 2) cover dHash stragglers — phase `covers` hashes at rehost time, so
    // this normally touches 0 rows; hard-capped per run to stay inside the
    // edge worker's compute limit (scoring must still happen regardless).
    let hashed = 0;
    let hashFailed = 0;
    for (const e of events) {
      const src = e.covers?.[0];
      if (!src || !src.includes(PUBLIC_OBJECT_MARKER)) continue;
      // cover_hash_src records the last ATTEMPTED url — a null hash beside it
      // means undecodable (webp-in-.jpg etc.); never retried, never renoised.
      if (e.cover_hash_src === src) continue;
      if (hashed + hashFailed >= MAX_HASHES_PER_RUN) {
        errors.push(`hash cap (${MAX_HASHES_PER_RUN}) hit; re-run to resume`);
        break;
      }
      const h = await dhashUrl(src);
      if (!h) hashFailed += 1;
      const { error: uErr } = await admin.from('events')
        .update({ cover_hash: h, cover_hash_src: src }).eq('id', e.id);
      if (uErr) errors.push(`hash update ${e.id}: ${uErr.message}`);
      else {
        e.cover_hash = h;
        e.cover_hash_src = src;
        if (h) hashed += 1;
      }
    }

    // 3) candidate pairs: per venue, sorted sweep inside the ±6h window
    const byVenue = new Map<string, Ev[]>();
    for (const e of events) byVenue.set(e.venue_id, [...(byVenue.get(e.venue_id) ?? []), e]);
    const pairs: Pair[] = [];
    for (const [vid, list] of byVenue) {
      list.sort((x, y) => Date.parse(x.starts_at) - Date.parse(y.starts_at));
      const name = venueNames.get(vid) ?? '';
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          if (Date.parse(list[j].starts_at) - Date.parse(list[i].starts_at) > SAME_EVENT_WINDOW_MS) break;
          pairs.push(scorePair(list[i], list[j], name));
        }
      }
    }
    pairs.sort((x, y) => y.score - x.score);

    // 4) act: autos first, then grey → Haiku. A merged-away loser voids its
    // remaining pairs; chains (A~B, B~C) resolve fully on the next run.
    // Verdicts persist in _dedup_verdicts so a pair judged DISTINCT never
    // re-pays a Haiku call on later runs (delete its row to force re-judging).
    const { data: vcRows, error: vcErr } = await admin
      .from('_dedup_verdicts')
      .select('pair_key, same_event, confidence, reason');
    if (vcErr) throw new Error(`verdict cache: ${vcErr.message}`);
    const verdictCache = new Map(
      ((vcRows ?? []) as unknown as ({ pair_key: string } & Verdict)[]).map(
        (v) => [v.pair_key, v],
      ),
    );
    const merged = new Set<string>();
    const merges: Record<string, unknown>[] = [];
    const adjudications: Record<string, unknown>[] = [];
    let deferred = 0;

    const doMerge = async (p: Pair, deciding: string) => {
      const [survivor, loser] =
        Date.parse(p.a.created_at) <= Date.parse(p.b.created_at) ? [p.a, p.b] : [p.b, p.a];
      const { data, error } = await admin.rpc('merge_event_pair', {
        p_survivor: survivor.id,
        p_loser: loser.id,
        p_deciding: deciding,
      });
      if (error) {
        errors.push(`merge ${loser.id}→${survivor.id}: ${error.message}`);
        return;
      }
      merged.add(loser.id);
      merges.push({
        survivor: survivor.id, survivor_title: survivor.title,
        loser: loser.id, loser_title: loser.title,
        venue: p.venueName, deciding,
        ...(data as Record<string, unknown>),
      });
    };

    if (!dryRun) {
      for (const p of pairs) {
        if (p.decision !== 'auto' || merged.has(p.a.id) || merged.has(p.b.id)) continue;
        if (merges.length >= maxMerges) {
          deferred += 1;
          continue;
        }
        await doMerge(p, `auto t=${p.t.toFixed(2)} score=${p.score.toFixed(2)} cover=${p.cover}`);
      }
      let freshAdjudications = 0;
      for (const p of pairs) {
        if (p.decision !== 'grey' || merged.has(p.a.id) || merged.has(p.b.id)) continue;
        const pairKey = [p.a.id, p.b.id].sort().join(':');
        const cached = verdictCache.get(pairKey);
        if (cached) {
          // Cached verdicts are free — they consume no adjudication budget.
          adjudications.push({
            a: p.a.id, b: p.b.id, title_a: p.a.title, title_b: p.b.title,
            venue: p.venueName, t: +p.t.toFixed(2), score: +p.score.toFixed(2),
            cached: true, verdict: cached,
          });
          if (cached.same_event && cached.confidence >= ADJUDICATE_MIN_CONFIDENCE && merges.length < maxMerges) {
            await doMerge(p, `adjudicated (cached) conf=${cached.confidence}: ${cached.reason}`.slice(0, 300));
          }
          continue;
        }
        if (freshAdjudications >= maxAdjudications) {
          deferred += 1;
          continue;
        }
        if (Date.now() - t0 > TIME_BUDGET_MS) {
          errors.push('time budget hit during adjudication; re-run to resume');
          break;
        }
        if (!anthropicKey) {
          errors.push('ANTHROPIC_API_KEY secret not set — grey pairs skipped');
          break;
        }
        try {
          const v = await adjudicate(anthropicKey, p.a, p.b, p.venueName);
          freshAdjudications += 1;
          adjudications.push({
            a: p.a.id, b: p.b.id, title_a: p.a.title, title_b: p.b.title,
            venue: p.venueName, t: +p.t.toFixed(2), score: +p.score.toFixed(2),
            verdict: v,
          });
          const { error: vcUpErr } = await admin.from('_dedup_verdicts').upsert({
            pair_key: pairKey, a: p.a.id, b: p.b.id,
            same_event: v.same_event, confidence: v.confidence, reason: v.reason,
          });
          if (vcUpErr) errors.push(`verdict cache upsert ${pairKey}: ${vcUpErr.message}`);
          if (v.same_event && v.confidence >= ADJUDICATE_MIN_CONFIDENCE && merges.length < maxMerges) {
            await doMerge(p, `adjudicated conf=${v.confidence}: ${v.reason}`.slice(0, 300));
          }
        } catch (e) {
          errors.push(`adjudicate ${p.a.id}/${p.b.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    const summary = {
      ok: errors.length === 0,
      dry_run: dryRun,
      events: events.length,
      hashed,
      hash_failed: hashFailed,
      pairs_evaluated: pairs.length,
      auto: pairs.filter((p) => p.decision === 'auto').length,
      grey: pairs.filter((p) => p.decision === 'grey').length,
      merges,
      adjudications,
      deferred,
      pairs: pairs.filter((p) => p.decision !== 'no').map((p) => ({
        decision: p.decision,
        a: p.a.id, b: p.b.id, title_a: p.a.title, title_b: p.b.title,
        venue: p.venueName,
        t: +p.t.toFixed(2), score: +p.score.toFixed(2),
        cover: p.cover, cover_dist: p.coverDist,
        exact_instant: p.exactInstant, both_midnight: p.bothMidnight, cat_eq: p.catEq,
      })),
      errors,
      elapsed_ms: Date.now() - t0,
    };

    await admin.from('ingest_runs').insert({
      source_handle: dryRun ? 'dedup:dry' : 'dedup',
      found: pairs.length,
      inserted: merges.length,
      errors: errors.length,
      error_detail: errors.length ? errors.join(' | ').slice(0, 2000) : null,
      finished_at: new Date().toISOString(),
    });

    // Same error contract as parse-venue: real errors → non-200 so the queue
    // ticker retries/records them (never a silent green); budget-resume
    // markers ('re-run to resume') stay 200 and re-enqueue via the ticker's
    // content match.
    const realErrors = errors.filter((e) => !/re-run to resume/.test(e));
    return Response.json(summary, { status: realErrors.length ? 500 : 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from('ingest_runs').insert({
      source_handle: 'dedup',
      errors: 1,
      error_detail: message,
      finished_at: new Date().toISOString(),
    }).then(() => {}, () => {});
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
