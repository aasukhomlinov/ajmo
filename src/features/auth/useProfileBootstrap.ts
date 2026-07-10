import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { fetchProfile, profileKeys, type Profile } from '@/lib/api/profile';
import { fetchSavedIds, savesKeys } from '@/lib/api/saves';
import { useAuth } from '@/lib/stores/auth';
import { useCity } from '@/lib/stores/city';
import { useSettings } from '@/lib/stores/settings';

// Session bootstrap (Auth-2): while the splash is up, load the signed-in
// user's profile and mirror it into the synchronous stores the screens read —
// language/push/reminder prefs into the settings store, active_city into the
// city store, onboarded_at into the gate's `onboarded` flag. Returns true once
// the mirrors are in place (or signed out), so the root layout can hold the
// splash until the app renders with the USER'S data — no flash of defaults and
// no mis-routed onboarding. The saved ids are prefetched alongside (not
// awaited — the feed has its own skeletons/error states).

async function loadProfile(userId: string): Promise<Profile> {
  return fetchProfile(userId);
}

/**
 * Load + apply the user-scoped state for the current session. Returns whether
 * the gate may render: true while signed out; once signed in, true only after
 * the profile has been mirrored into the stores (or the fetch failed and the
 * fallback applied).
 */
export function useProfileBootstrap(): boolean {
  const userId = useAuth((s) => s.session?.user.id);
  const queryClient = useQueryClient();
  const [appliedFor, setAppliedFor] = useState<string | null>(null);

  const { data: profile, isError } = useQuery({
    queryKey: profileKeys.detail(userId ?? 'anon'),
    queryFn: () => loadProfile(userId as string),
    enabled: Boolean(userId),
    // The app owns every write (write-through setters), so a background
    // refetch could only clobber newer local state — never refetch.
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!userId) {
      setAppliedFor(null);
      return;
    }
    if (profile) {
      useSettings.getState().applyProfile(profile);
      useCity.getState().applyProfile(profile.activeCity);
      useAuth.getState().setOnboarded(profile.onboardedAt != null);
      // Warm the saves cache so the feed's "+" states are right on first paint.
      void queryClient.prefetchQuery({
        queryKey: savesKeys.list(userId),
        queryFn: () => fetchSavedIds(userId),
      });
      setAppliedFor(userId);
    } else if (isError) {
      // Profile unreachable (offline / backend down) — keep the defaults and
      // assume onboarded so a returning user isn't dumped into onboarding;
      // the feeds surface their own error states.
      useAuth.getState().setOnboarded(true);
      setAppliedFor(userId);
    }
  }, [userId, profile, isError, queryClient]);

  return userId == null || appliedFor === userId;
}
