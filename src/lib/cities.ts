import type { TranslationKey, Translator } from '@/lib/i18n';

import type { CityId } from './types';

// The two launch cities (CLAUDE.md: Belgrade + Novi Sad, chosen MANUALLY from a
// 2-item list — NO geolocation). Mirrors the future `cities` table; the city
// picker, the Discover header label and the city-scoped feed/search all read
// the catalog from here so the set of cities lives in one place. Display names
// are localized (Belgrade / Белград / Beograd) — pass the translator from useT().
export interface City {
  id: CityId;
  /** i18n key for the display name — render via t(city.nameKey). */
  nameKey: TranslationKey;
}

export const CITIES: readonly City[] = [
  { id: 'belgrade', nameKey: 'city.belgrade' },
  { id: 'novi-sad', nameKey: 'city.noviSad' },
];

/** All valid city ids — used by the store to validate persisted values. */
export const CITY_IDS: readonly CityId[] = CITIES.map((c) => c.id);

/** Picker row label for a city id, e.g. "Belgrade" / "Белград" / "Beograd". */
export function cityName(id: CityId, t: Translator): string {
  const key = CITIES.find((c) => c.id === id)?.nameKey;
  return key ? t(key) : '';
}

/** Discover header pill label, e.g. "Belgrade, RS". */
export function cityHeaderLabel(id: CityId, t: Translator): string {
  return `${cityName(id, t)}, RS`;
}
