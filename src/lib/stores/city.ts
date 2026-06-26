import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { CITY_IDS } from '@/lib/cities';
import type { CityId } from '@/lib/types';

// Active-city store — the single source of truth for which city the app is
// scoped to (the Discover header pill + the city-filtered feed/search). Per
// CLAUDE.md the city is chosen MANUALLY from a 2-item list (NO geolocation); it
// defaults to Belgrade and is persisted locally so the choice survives a
// relaunch (same expo-secure-store pattern as the saves store, hydrated once in
// _layout). When auth + the per-user Supabase profile land, the active city
// moves onto `profiles.city_id` and hydrate/persist swap to that query — the
// call sites (useActiveCity / setCity) stay the same.
const STORAGE_KEY = 'ajmo.city.v1';
const DEFAULT_CITY: CityId = 'belgrade';

function parse(raw: string | null): CityId {
  return raw != null && (CITY_IDS as readonly string[]).includes(raw)
    ? (raw as CityId)
    : DEFAULT_CITY;
}

function persist(city: CityId): void {
  // Fire-and-forget; a failed write just means this choice isn't durable.
  SecureStore.setItemAsync(STORAGE_KEY, city).catch(() => {});
}

interface CityState {
  /** The active city scope. Defaults to Belgrade until hydrate/selection. */
  activeCity: CityId;
  /** True once the persisted city has been read from storage (see hydrate). */
  hydrated: boolean;
  /** Set the active city, then persist. No-op when unchanged. */
  setCity: (city: CityId) => void;
  /** Load the persisted city once on app start. Safe to call repeatedly. */
  hydrate: () => Promise<void>;
}

export const useCity = create<CityState>((set, get) => ({
  activeCity: DEFAULT_CITY,
  hydrated: false,
  setCity: (city) =>
    set((state) => {
      if (state.activeCity === city) return state;
      persist(city);
      return { activeCity: city };
    }),
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      set({ activeCity: parse(raw), hydrated: true });
    } catch {
      // First launch / unavailable store — keep the default but mark hydrated so
      // we don't keep retrying.
      set({ hydrated: true });
    }
  },
}));

/** Reactive: the active city scope. */
export const useActiveCity = (): CityId => useCity((s) => s.activeCity);

/** Reactive: the setter (stable reference). */
export const useSetCity = (): ((city: CityId) => void) => useCity((s) => s.setCity);
