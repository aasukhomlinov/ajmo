import type { CityId } from './types';

// The two launch cities (CLAUDE.md: Belgrade + Novi Sad, chosen MANUALLY from a
// 2-item list — NO geolocation). Mirrors the future `cities` table; the city
// picker, the Discover header label and the city-scoped feed/search all read
// the catalog from here so the set of cities lives in one place.
export interface City {
  id: CityId;
  /** Row label in the picker, e.g. "Belgrade". */
  name: string;
}

export const CITIES: readonly City[] = [
  { id: 'belgrade', name: 'Belgrade' },
  { id: 'novi-sad', name: 'Novi Sad' },
];

/** All valid city ids — used by the store to validate persisted values. */
export const CITY_IDS: readonly CityId[] = CITIES.map((c) => c.id);

/** Picker row label for a city id, e.g. "Belgrade". */
export function cityName(id: CityId): string {
  return CITIES.find((c) => c.id === id)?.name ?? '';
}

/** Discover header pill label, e.g. "Belgrade, RS". */
export function cityHeaderLabel(id: CityId): string {
  return `${cityName(id)}, RS`;
}
