import type { Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

// Auth/session store — the single source of truth the root hard gate reads
// (see CLAUDE.md: no guest browsing; the whole app requires a signed-in user).
// The Supabase client persists the session in SecureStore; this store mirrors
// it into React state: `restoring` until the persisted session has been read
// (the root layout keeps the splash up meanwhile, so signed-in users never see
// an auth-screen flash), then signedIn/signedOut driven by onAuthStateChange.
//
// `onboarded` marks the post-first-sign-in flow (city picker → notifications)
// as completed. MVP: it's a DEVICE-level SecureStore flag, deliberately NOT
// cleared on sign-out — the city choice is also still local (see the city
// store), so a returning user on the same device skips straight to the app.
// Auth-2 moves both onto the per-user Supabase profile.

/**
 * Deep link the magic-link email redirects back to. Hardcoded (not
 * Linking.createURL) so it always matches the allowlist entry configured in
 * Supabase Auth → URL Configuration, in dev builds and release alike.
 */
export const AUTH_REDIRECT_URL = 'ajmo://auth/callback';

const ONBOARDED_KEY = 'ajmo.onboarded.v1';

export type AuthStatus = 'restoring' | 'signedIn' | 'signedOut';

/** Outcome of handling a magic-link callback URL. */
export type AuthLinkResult = 'signedIn' | 'expired' | 'noParams';

/** First index of `sep`, or the whole string + undefined when absent. */
function splitOnce(value: string, sep: string): [string, string | undefined] {
  const i = value.indexOf(sep);
  return i === -1 ? [value, undefined] : [value.slice(0, i), value.slice(i + 1)];
}

// GoTrue's verify endpoint returns the tokens (implicit flow) or the error in
// the URL *fragment*; some error paths use the query string. Merge both.
function parseAuthParams(url: string): URLSearchParams {
  const merged = new URLSearchParams();
  const [beforeFragment, fragment] = splitOnce(url, '#');
  const [, query] = splitOnce(beforeFragment, '?');
  for (const chunk of [query, fragment]) {
    if (!chunk) continue;
    new URLSearchParams(chunk).forEach((value, key) => merged.set(key, value));
  }
  return merged;
}

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  /** Post-sign-in onboarding (city → notifications) completed on this device. */
  onboarded: boolean;
  /** Email the last magic link went to — for resend on Sent/Expired. In-memory only. */
  lastEmail: string | null;
  /** Restore the persisted session once on app start + subscribe to auth changes. */
  hydrate: () => Promise<void>;
  /** Request a magic link. Resolves to null on success or an error message. */
  sendMagicLink: (email: string) => Promise<string | null>;
  /** Establish the session from a magic-link callback deep link. */
  completeFromUrl: (url: string) => Promise<AuthLinkResult>;
  /** Mark the post-sign-in onboarding flow finished, then persist. */
  completeOnboarding: () => void;
  /** End the session (server + local) and return to the auth flow via the gate. */
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'restoring',
  session: null,
  onboarded: false,
  lastEmail: null,

  hydrate: async () => {
    if (get().status !== 'restoring') return;
    let session: Session | null = null;
    let onboarded = false;
    try {
      const [{ data }, onboardedRaw] = await Promise.all([
        supabase.auth.getSession(),
        SecureStore.getItemAsync(ONBOARDED_KEY).catch(() => null),
      ]);
      session = data.session;
      onboarded = onboardedRaw === 'true';
    } catch {
      // Unreadable storage — treat as signed out; the gate shows the auth flow.
    }
    set({ session, onboarded, status: session ? 'signedIn' : 'signedOut' });
    // Keep the gate in sync from here on (sign-in via deep link, sign-out,
    // token refresh, session expiry).
    supabase.auth.onAuthStateChange((_event, next) => {
      set({ session: next, status: next ? 'signedIn' : 'signedOut' });
    });
  },

  sendMagicLink: async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: AUTH_REDIRECT_URL },
    });
    if (error) return error.message;
    set({ lastEmail: email });
    return null;
  },

  completeFromUrl: async (url) => {
    const params = parseAuthParams(url);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (!error && data.session) {
        // Set synchronously (onAuthStateChange fires async) so the caller can
        // navigate into a gated route right away without a guard race.
        set({ session: data.session, status: 'signedIn' });
        return 'signedIn';
      }
      return 'expired';
    }
    // GoTrue reports consumed/expired links as error_code=otp_expired (or a
    // generic access_denied). All error shapes get the same "expired" UX.
    if (params.get('error') || params.get('error_code')) return 'expired';
    return 'noParams';
  },

  completeOnboarding: () => {
    set({ onboarded: true });
    // Fire-and-forget; a failed write just means onboarding repeats next launch.
    SecureStore.setItemAsync(ONBOARDED_KEY, 'true').catch(() => {});
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      // Global revoke failed (offline etc.) — still drop the local session so
      // the gate returns to auth; the refresh token dies on its own server-side.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    }
    set({ session: null, status: 'signedOut', lastEmail: null });
  },
}));

/** Reactive: the gate status (restoring / signedIn / signedOut). */
export const useAuthStatus = (): AuthStatus => useAuth((s) => s.status);

/** Reactive: whether the post-sign-in onboarding flow finished on this device. */
export const useOnboarded = (): boolean => useAuth((s) => s.onboarded);

/** Reactive: the signed-in user's email (undefined while signed out). */
export const useUserEmail = (): string | undefined => useAuth((s) => s.session?.user.email);
