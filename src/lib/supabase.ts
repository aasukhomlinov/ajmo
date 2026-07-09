import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill in your Supabase project values.',
  );
}

/**
 * Auth storage adapter for the Supabase session.
 *
 * Auth is a hard gate (see CLAUDE.md): the whole app requires a signed-in user,
 * so the session must persist across app restarts. On native we keep it in the
 * device keychain/keystore via expo-secure-store; web has no SecureStore, so we
 * fall back to localStorage (used only by `expo start --web` during dev).
 */
type AuthStorage = {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
};

const secureStorage: AuthStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const webStorage: AuthStorage = {
  getItem: (key) => (typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null),
  setItem: (key, value) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? webStorage : secureStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Native app: there's no URL fragment to parse after OAuth redirects.
    // Magic-link callbacks are handled explicitly (auth store completeFromUrl).
    detectSessionInUrl: false,
  },
});

// Supabase's auto-refresh timer can't see app visibility on native, so it must
// be driven by AppState (per the Supabase RN guide): refresh while foregrounded,
// pause in the background — otherwise a long-backgrounded app comes back with an
// expired access token and the first queries fail.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
  if (AppState.currentState === 'active') {
    void supabase.auth.startAutoRefresh();
  }
}
