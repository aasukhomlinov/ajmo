// Type-only import from the en dictionary directly (NOT the i18n index, which
// imports the settings store — the type is erased at runtime, so no cycle).
import type { TranslationKey } from '@/lib/i18n/en';

// User-preference catalogs shared by the settings store (the reactive mirror),
// the profile API (validation of DB values) and the Profile screens. Kept out
// of the store module so the API layer can import them without a cycle.

/** App-language preference. Native names shown in the picker; codes used here. */
export type LanguageId = 'en' | 'sr' | 'ru';

export interface Language {
  id: LanguageId;
  /** Row label in the picker, in its own language (e.g. "Srpski"). */
  name: string;
}

// Catalog order matches the Language frame (207:1181): English, Srpski, Русский.
export const LANGUAGES: readonly Language[] = [
  { id: 'en', name: 'English' },
  { id: 'sr', name: 'Srpski' },
  { id: 'ru', name: 'Русский' },
];

export const LANGUAGE_IDS: readonly LanguageId[] = LANGUAGES.map((l) => l.id);

/** Picker label for a language id, e.g. "English". */
export function languageName(id: LanguageId): string {
  return LANGUAGES.find((l) => l.id === id)?.name ?? '';
}

/** Lead-time before an event at which to remind. Multi-select (see the frame). */
export type ReminderOffset = '1_week' | '2_days' | '1_day' | 'day_of';

export interface ReminderOption {
  value: ReminderOffset;
  /** i18n key for the row label — render via t(option.labelKey). */
  labelKey: TranslationKey;
}

// Catalog order matches the Event reminders frame (239:1275); copy lives in
// the i18n dictionaries.
export const REMINDER_OPTIONS: readonly ReminderOption[] = [
  { value: '1_week', labelKey: 'reminders.oneWeek' },
  { value: '2_days', labelKey: 'reminders.twoDays' },
  { value: '1_day', labelKey: 'reminders.oneDay' },
  { value: 'day_of', labelKey: 'reminders.dayOf' },
];

export const REMINDER_VALUES: readonly ReminderOffset[] = REMINDER_OPTIONS.map((o) => o.value);
