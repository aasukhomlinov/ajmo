import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

// Shared save store — the single source of truth for which events the user has
// bookmarked (the "+" on a feed card / the Save button on Event Detail). Per
// CLAUDE.md this is a single flat "save" (no going/like); the Saved screen reads
// straight from here.
//
// In-memory for MVP (NO Supabase, NO auth yet), but the shape — a set of event
// ids with toggle/read + hydrate/persist — mirrors a future user-scoped
// `saved_events` table, so the swap is a query/mutation change rather than a
// refactor of the call sites. Persisted locally via expo-secure-store (same
// pattern as useRecentSearches) so saves survive a relaunch; when auth + the
// per-user Supabase query land, replace hydrate/persist with that query and drop
// the local storage.
const STORAGE_KEY = 'ajmo.saves.v1';

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

function persist(ids: Set<string>): void {
  // Fire-and-forget; a failed write just means this change isn't durable.
  SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify([...ids])).catch(() => {});
}

interface SavesState {
  /** The saved event ids. A NEW Set is created on every change so subscribers re-render. */
  savedIds: Set<string>;
  /** True once the persisted set has been read from storage (see hydrate). */
  hydrated: boolean;
  /** Add or remove an id, then persist. */
  toggleSave: (id: string) => void;
  /** Imperative membership check. In components prefer the reactive useIsSaved. */
  isSaved: (id: string) => boolean;
  /** Load the persisted ids once on app start. Safe to call repeatedly (no-op after the first). */
  hydrate: () => Promise<void>;
}

export const useSaves = create<SavesState>((set, get) => ({
  savedIds: new Set(),
  hydrated: false,
  toggleSave: (id) =>
    set((state) => {
      const next = new Set(state.savedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persist(next);
      return { savedIds: next };
    }),
  isSaved: (id) => get().savedIds.has(id),
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      set({ savedIds: new Set(parse(raw)), hydrated: true });
    } catch {
      // First launch / unavailable store — start empty but mark hydrated so we
      // don't keep retrying.
      set({ hydrated: true });
    }
  },
}));

/** Reactive: re-renders the caller only when THIS id's saved state flips. */
export const useIsSaved = (id: string): boolean => useSaves((s) => s.savedIds.has(id));

/** Reactive: the current set of saved ids (new reference on every change). */
export const useSavedIds = (): Set<string> => useSaves((s) => s.savedIds);
