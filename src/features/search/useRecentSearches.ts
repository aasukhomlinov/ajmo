import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

// Recent search history — the user's last few typed queries, shown as tappable
// chips on Search · Empty. Persisted locally (expo-secure-store) so they survive
// an app relaunch; scoped to the device, not the user (no backend in MVP). When
// search moves to Supabase this can become a per-user query-history table.
const STORAGE_KEY = 'ajmo.search.recent.v1';
const MAX_RECENT = 8;

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((q): q is string => typeof q === 'string').slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);

  // Hydrate from storage once on mount.
  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((raw) => {
        if (active) setRecent(parse(raw));
      })
      .catch(() => {
        /* first launch / unavailable store — start empty */
      });
    return () => {
      active = false;
    };
  }, []);

  // Push a query to the front (case-insensitive de-dupe), cap the list, persist.
  const addRecent = useCallback((raw: string) => {
    const query = raw.trim();
    if (!query) return;
    setRecent((prev) => {
      const next = [query, ...prev.filter((q) => q.toLowerCase() !== query.toLowerCase())].slice(
        0,
        MAX_RECENT,
      );
      SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { recent, addRecent };
}
