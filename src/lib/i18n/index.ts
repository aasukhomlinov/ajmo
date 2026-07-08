import { useMemo } from 'react';

import { useLanguage, type LanguageId } from '@/lib/stores/settings';

import { en, type TranslationKey } from './en';
import { ru } from './ru';
import { sr } from './sr';

// Minimal in-house i18n for UI chrome (no library — three static dictionaries
// don't need i18next). The active language comes from the settings store; every
// key is typed against the en dictionary, so tsc catches missing/misspelled
// keys at the call site AND missing translations in ru/sr (they are
// Record<TranslationKey, string>). Event CONTENT is localized separately by the
// API layer (title_i18n/description_i18n) — this file is interface copy only.

export type { TranslationKey };

const DICTIONARIES: Record<LanguageId, Record<TranslationKey, string>> = { en, ru, sr };

/** Values for `{name}` placeholders in a dictionary string. */
export type TranslationVars = Record<string, string | number>;

/** Base key of a `.one`/`.few`/`.many` plural triple, e.g. "search.results". */
export type PluralKey = TranslationKey extends infer K
  ? K extends `${infer Base}.one`
    ? Base
    : never
  : never;

function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** The string for `key` in `lang` (en as a defensive runtime fallback). */
export function translate(lang: LanguageId, key: TranslationKey, vars?: TranslationVars): string {
  return interpolate(DICTIONARIES[lang][key] ?? en[key], vars);
}

// CLDR-ish plural category. en: one/other; ru + sr share the Slavic rules —
// one (1, 21, 31…), few (2–4, 22–24… but not 12–14), many (the rest).
function pluralForm(lang: LanguageId, n: number): 'one' | 'few' | 'many' {
  const abs = Math.abs(n);
  if (lang === 'en') return abs === 1 ? 'one' : 'many';
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return 'one';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
  return 'many';
}

/** Plural-aware count string: picks `${base}.one|few|many` and fills {count}. */
export function translateCount(lang: LanguageId, base: PluralKey, count: number): string {
  const key = `${base}.${pluralForm(lang, count)}` as TranslationKey;
  return translate(lang, key, { count });
}

export interface Translator {
  (key: TranslationKey, vars?: TranslationVars): string;
  /** Plural-aware count string, e.g. t.count('search.results', 3) → "3 results". */
  count: (base: PluralKey, count: number) => string;
  /** The active language — pass to the datetime helpers / catalogs. */
  lang: LanguageId;
}

/** Non-hook translator for a fixed language (the hook below is the usual way in). */
export function getTranslator(lang: LanguageId): Translator {
  const t = ((key: TranslationKey, vars?: TranslationVars) =>
    translate(lang, key, vars)) as Translator;
  t.count = (base, count) => translateCount(lang, base, count);
  t.lang = lang;
  return t;
}

/**
 * Reactive translator bound to the profile language. Components re-render (and
 * every t() re-resolves) as soon as the language changes in Profile → Language;
 * `t` is referentially stable per language, so it is safe in hook deps.
 */
export function useT(): Translator {
  const lang = useLanguage();
  return useMemo(() => getTranslator(lang), [lang]);
}
