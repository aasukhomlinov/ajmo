import { create } from 'zustand';

import { updateProfile } from '@/lib/api/profile';
import type { CityId } from '@/lib/types';

// Active-city store — the synchronous, reactive MIRROR of the profile's
// active_city (Auth-2): the Discover header pill + the city-filtered feed and
// search all read from here. Per CLAUDE.md the city is chosen MANUALLY from a
// 2-item list (NO geolocation). The Supabase profile is the durable source of
// truth; this store is hydrated from it at sign-in (useProfileBootstrap) and
// setCity writes through to the profile. Belgrade is the default until the
// user picks (a fresh profile has active_city_id = null).
const DEFAULT_CITY: CityId = 'belgrade';

interface CityState {
  /** The active city scope. Defaults to Belgrade until the profile loads / selection. */
  activeCity: CityId;
  /** Set the active city, then persist to the profile. No-op when unchanged. */
  setCity: (city: CityId) => void;
  /** Adopt the fetched profile value (no write back). Null keeps the default. */
  applyProfile: (city: CityId | null) => void;
  /** Back to the default — called on sign-out so the next user starts clean. */
  reset: () => void;
}

export const useCity = create<CityState>((set) => ({
  activeCity: DEFAULT_CITY,
  setCity: (city) =>
    set((state) => {
      if (state.activeCity === city) return state;
      // Fire-and-forget; a failed write just means this choice isn't durable.
      updateProfile({ activeCity: city }).catch((error: unknown) => {
        if (__DEV__) console.warn('[city] profile write failed', error);
      });
      return { activeCity: city };
    }),
  applyProfile: (city) => set({ activeCity: city ?? DEFAULT_CITY }),
  reset: () => set({ activeCity: DEFAULT_CITY }),
}));

/** Reactive: the active city scope. */
export const useActiveCity = (): CityId => useCity((s) => s.activeCity);

/** Reactive: the setter (stable reference). */
export const useSetCity = (): ((city: CityId) => void) => useCity((s) => s.setCity);
