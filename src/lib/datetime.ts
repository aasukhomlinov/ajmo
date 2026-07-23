import { format, isSameDay, parseISO, type Locale } from 'date-fns';
import { ru, srLatn } from 'date-fns/locale';

import type { LanguageCode } from './types';

// Event time formatting. All helpers take an ISO-8601 string (Event.starts_at /
// ends_at) and render in the device's local zone via date-fns. Kept in one place
// so the card chip, the meta row, and the day-section headers stay consistent.
//
// Labels with month/weekday words take the active UI language (pass t.lang from
// useT() / useLanguage()): en uses the date-fns default, ru the Cyrillic locale,
// sr the LATIN-script locale (project convention). Patterns differ per language
// because word order / day-number punctuation differ (en "Friday, Jun 12" vs
// ru "пятница, 12 июн." vs sr "petak, 12. jun"). Times stay 24h HH:mm everywhere.

const LOCALES: Record<LanguageCode, Locale | undefined> = {
  en: undefined, // date-fns default (en-US)
  ru,
  sr: srLatn,
};

const SECTION_PATTERNS: Record<LanguageCode, string> = {
  en: 'EEEE, MMM d',
  ru: 'EEEE, d MMM',
  sr: 'EEEE, d. MMM',
};

const CHIP_PATTERNS: Record<LanguageCode, string> = {
  en: 'EEE d MMM',
  ru: 'EEE d MMM',
  sr: 'EEE d. MMM',
};

const DETAIL_PATTERNS: Record<LanguageCode, string> = {
  en: 'EEEE, d MMMM',
  ru: 'EEEE, d MMMM',
  sr: 'EEEE, d. MMMM',
};

// ru/sr weekdays are lowercase mid-sentence; standalone labels read better
// capitalized (en is already capitalized — no-op).
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Stable per-day grouping key, e.g. "2026-06-13". Local day. */
export function dayKey(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd');
}

/** Day-section header label, e.g. "Friday, Jun 12" / "Пятница, 12 июн." */
export function daySectionLabel(iso: string, lang: LanguageCode): string {
  return capitalize(format(parseISO(iso), SECTION_PATTERNS[lang], { locale: LOCALES[lang] }));
}

/** Lime cover chip, e.g. "FRI 12 JUN · 21:00" (date + start time, uppercased). */
export function dateChipLabel(iso: string, lang: LanguageCode): string {
  const date = format(parseISO(iso), CHIP_PATTERNS[lang], { locale: LOCALES[lang] });
  return `${date.toUpperCase()} · ${format(parseISO(iso), 'HH:mm')}`;
}

/** Event-detail date line, e.g. "Saturday, 13 June" / "Суббота, 13 июня". */
export function detailDateLabel(iso: string, lang: LanguageCode): string {
  return capitalize(format(parseISO(iso), DETAIL_PATTERNS[lang], { locale: LOCALES[lang] }));
}

// Multi-day run ranges (exhibitions): month word order / punctuation per
// language, full month for meta/detail lines, abbreviated for the cover chip.
const RANGE_PATTERNS: Record<LanguageCode, string> = {
  en: 'd MMMM',
  ru: 'd MMMM',
  sr: 'd. MMMM',
};

const RANGE_CHIP_PATTERNS: Record<LanguageCode, string> = {
  en: 'd MMM',
  ru: 'd MMM',
  sr: 'd. MMM',
};

/** True when the event runs across multiple calendar days (exhibition-style range). */
export function isMultiDay(startIso: string, endIso?: string): boolean {
  return Boolean(endIso) && dayKey(endIso as string) !== dayKey(startIso);
}

function rangeLabel(
  startIso: string,
  endIso: string,
  lang: LanguageCode,
  patterns: Record<LanguageCode, string>,
): string {
  const start = parseISO(startIso);
  const end = parseISO(endIso);
  // Same month: "5–21 July"; across months both ends spell the month out
  // ("28 July – 3 August"); across years both ends carry the year too
  // ("25 May 2021 – 25 May 2027" — multi-year museum runs).
  const pattern =
    start.getFullYear() === end.getFullYear() ? patterns[lang] : `${patterns[lang]} yyyy`;
  const endLabel = format(end, pattern, { locale: LOCALES[lang] });
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${format(start, 'd')}–${endLabel}`;
  }
  return `${format(start, pattern, { locale: LOCALES[lang] })} – ${endLabel}`;
}

/** Run-range line, e.g. "5–21 July" / "5–21 июля" / "5–21. jul". */
export function dateRangeLabel(startIso: string, endIso: string, lang: LanguageCode): string {
  return rangeLabel(startIso, endIso, lang, RANGE_PATTERNS);
}

/** Cover-chip run range, abbreviated + uppercased, e.g. "5–21 JUL". */
export function dateRangeChipLabel(startIso: string, endIso: string, lang: LanguageCode): string {
  return rangeLabel(startIso, endIso, lang, RANGE_CHIP_PATTERNS).toUpperCase();
}

/** Meta-row time, e.g. "21:00" or "20:00 – 22:00" when an end time exists. */
export function timeLabel(startIso: string, endIso?: string): string {
  const start = format(parseISO(startIso), 'HH:mm');
  if (!endIso) return start;
  return `${start} – ${format(parseISO(endIso), 'HH:mm')}`;
}

/** True when the instant falls on the same calendar day as `reference`. */
export function isSameLocalDay(iso: string, reference: Date): boolean {
  return isSameDay(parseISO(iso), reference);
}
