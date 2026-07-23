// Shared title-similarity toolkit: insert-time dedup (parse-venue) and the
// post-translate reconciliation pass (dedup-events) must agree on what "same
// title" means, so both import from here.
//
// Serbian is digraphic — the same event gets posted in Cyrillic AND Latin
// (the Silosi exhibition pair), so everything is transliterated to Latin and
// diacritic-folded (š→s, đ→dj, џ→dz …) BEFORE tokenizing. Matching-only:
// never feed these outputs back into stored values or source_ref slugs
// (titleSlug in parse-venue stays on the legacy normalizer for that reason).

const CYR_TO_LAT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'dj', е: 'e', ж: 'z', з: 'z',
  и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', ћ: 'c', у: 'u', ф: 'f', х: 'h', ц: 'c',
  ч: 'c', џ: 'dz', ш: 's',
  // Russian letters outside the Serbian set (both languages appear in sources).
  // The mapping only has to be CONSISTENT, not linguistically perfect — both
  // sides of every comparison pass through it.
  ё: 'jo', й: 'j', щ: 'sc', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'ju', я: 'ja',
};
const LAT_FOLD: Record<string, string> = { đ: 'dj', ž: 'z', č: 'c', ć: 'c', š: 's' };

/** lowercase → Cyrillic→Latin → diacritics folded → non-alphanumerics to spaces. */
export function normalizeTitle(t: string): string {
  let s = '';
  for (const ch of t.toLowerCase()) s += CYR_TO_LAT[ch] ?? LAT_FOLD[ch] ?? ch;
  // Remaining accents (AVÖ, café …) fold via NFD mark-stripping.
  s = s.normalize('NFD').replace(/\p{M}+/gu, '');
  return s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// All entries in FOLDED form (see normalizeTitle) — Cyrillic input arrives
// here already transliterated, so 'киноклуб' is matched by 'kinoklub'.
// Extend as needed (ru/sr/en).
const STOP_WORDS = new Set([
  's', 'sa', 'i', 'u', 'v', 'na', 'za', 'o', 'ob', 'pro',
  'the', 'a', 'an', 'of', 'and', 'with', 'from', 'this', 'at', 'on', 'over', 'takes',
]);
// Recurring event-format words that frame a title. Weekday/promo framing added
// after the Karmakoma miss ("THIS SATURDAY | Karmakoma takeover…" vs "Club
// Drugstore takes over Karmakoma…" scored 0.67).
const FORMAT_MARKERS = new Set([
  'kinoklub', 'klub', 'club', 'film', 'filmski',
  'koncert', 'concert', 'izlozba', 'vystavka', 'exhibition',
  'radionica', 'workshop', 'vece', 'vecer',
  'zurka', 'party', 'zabava', 'quiz', 'kviz',
  'predstava', 'predstavlenie', 'spektakl', 'dj', 'live', 'uzivo',
  'pokaz', 'projekcija', 'screening',
  'takeover', 'tonight', 'today', 'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday',
]);

export function distinctiveTokens(title: string, venueName: string): Set<string> {
  const venueTokens = normalizeTitle(venueName).split(' ').filter(Boolean);
  // Serbian declension inflects venue names ("uživo u Silosima" vs "Silosi"):
  // prefix-match venue tokens instead of exact equality.
  const isVenueWord = (tok: string) =>
    venueTokens.some(
      (v) => tok === v || (v.length >= 4 && tok.length >= 4 && (tok.startsWith(v) || v.startsWith(tok))),
    );
  const out = new Set<string>();
  for (const tok of normalizeTitle(title).split(' ')) {
    if (tok.length < 2) continue;
    if (STOP_WORDS.has(tok) || FORMAT_MARKERS.has(tok) || isVenueWord(tok)) continue;
    if (/^\d{4}$/.test(tok)) continue; // years
    out.add(tok);
  }
  return out;
}

/** Distinctive-token overlap ratio (shared / smaller set), 0..1. All-frame
 * titles fall back to exact normalized equality so recurring formats never
 * score high blindly. */
export function titleSimilarity(titleA: string, titleB: string, venueName: string): number {
  const a = distinctiveTokens(titleA, venueName);
  const b = distinctiveTokens(titleB, venueName);
  if (!a.size || !b.size) return normalizeTitle(titleA) === normalizeTitle(titleB) ? 1 : 0;
  let shared = 0;
  for (const tok of a) if (b.has(tok)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

/** Fuzzy-dedup time window: two posts announcing one event often parse the
 * start an hour or two apart (Karmakoma 22:00 vs 23:00), so same-instant
 * matching let the pair through. ±6h merges hour-wobble but keeps a matinee
 * vs evening show (≥9h) and day-apart repertoire runs separate. */
export const SAME_EVENT_WINDOW_MS = 6 * 3600_000;
export function nearInstant(a: string, b: string): boolean {
  return Math.abs(Date.parse(a) - Date.parse(b)) <= SAME_EVENT_WINDOW_MS;
}

/** Insert-time verdict (parse-venue): near-instant titles only. */
export function isSameEvent(titleA: string, titleB: string, venueName: string): boolean {
  return titleSimilarity(titleA, titleB, venueName) >= 0.7;
}
