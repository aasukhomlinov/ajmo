import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/lib/stores/auth';
import { supabase } from '@/lib/supabase';

// User-scoped saves (Auth-2 — replaces src/lib/stores/saves.ts as the source of
// truth for which events the user bookmarked). The id list lives in a react-query
// cache keyed by user id and is backed by the `saves` table (RLS: own rows only).
// Toggling is OPTIMISTIC: the cached list flips before the network round trip so
// the feed "+" → lime check, the detail Save button and the Saved list respond
// instantly, and rolls back if the write fails.

const EMPTY_IDS: string[] = [];

export const savesKeys = {
  all: ['saves'] as const,
  list: (userId: string) => ['saves', userId] as const,
};

// Shared key so onSettled can tell whether OTHER toggles are still in flight
// (refetching between two rapid toggles would bounce the UI).
const TOGGLE_MUTATION_KEY = ['saves', 'toggle'] as const;

/** Reactive: the signed-in user's id (undefined while signed out). */
function useUserId(): string | undefined {
  return useAuth((s) => s.session?.user.id);
}

/** Saved event ids, most recent first. RLS scopes rows; the eq is belt-and-braces. */
export async function fetchSavedIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('saves')
    .select('event_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((row: { event_id: string }) => row.event_id);
}

/** The user's saved-ids query. Disabled (never fetches) while signed out. */
export function useSavedIdsQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: savesKeys.list(userId ?? 'anon'),
    queryFn: () => fetchSavedIds(userId as string),
    enabled: Boolean(userId),
  });
}

/** Reactive: the saved ids as a Set (empty while loading/signed out). */
export function useSavedIdSet(): Set<string> {
  const { data } = useSavedIdsQuery();
  return useMemo(() => new Set(data ?? EMPTY_IDS), [data]);
}

/** Reactive: whether THIS event is saved. */
export function useIsSaved(id: string): boolean {
  const { data } = useSavedIdsQuery();
  return (data ?? EMPTY_IDS).includes(id);
}

interface ToggleVars {
  eventId: string;
  /** Saved state at press time — decides insert vs delete. */
  saved: boolean;
}

/**
 * Toggle a save with an optimistic cache update. Returns a stable-ish callback:
 * `toggleSave(eventId, currentlySaved)`. Insert is an ignore-duplicates upsert
 * and delete is idempotent, so rapid double-taps can't error on conflicts.
 */
export function useToggleSave(): (eventId: string, saved: boolean) => void {
  const queryClient = useQueryClient();
  const userId = useUserId();

  const mutation = useMutation({
    mutationKey: TOGGLE_MUTATION_KEY,
    mutationFn: async ({ eventId, saved }: ToggleVars) => {
      if (!userId) throw new Error('Not signed in');
      if (saved) {
        const { error } = await supabase
          .from('saves')
          .delete()
          .eq('user_id', userId)
          .eq('event_id', eventId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('saves')
          .upsert(
            { user_id: userId, event_id: eventId },
            { onConflict: 'user_id,event_id', ignoreDuplicates: true },
          );
        if (error) throw error;
      }
    },
    onMutate: async ({ eventId, saved }) => {
      const key = savesKeys.list(userId as string);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<string[]>(key);
      queryClient.setQueryData<string[]>(key, (ids = EMPTY_IDS) =>
        saved ? ids.filter((id) => id !== eventId) : [eventId, ...ids.filter((id) => id !== eventId)],
      );
      return { key, previous };
    },
    onError: (_error, _vars, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
    },
    onSettled: () => {
      // Reconcile with the server only once the LAST in-flight toggle lands.
      if (queryClient.isMutating({ mutationKey: TOGGLE_MUTATION_KEY }) === 1) {
        void queryClient.invalidateQueries({ queryKey: savesKeys.all });
      }
    },
  });

  return (eventId, saved) => mutation.mutate({ eventId, saved });
}
