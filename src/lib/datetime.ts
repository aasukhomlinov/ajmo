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
