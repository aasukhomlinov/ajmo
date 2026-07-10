import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

// OS notification-permission state, shared app-wide. profiles.push_enabled
// stores the user's INTENT; this module tracks what the OS actually allows —
// scheduling requires both. One zustand store (not per-hook state) so a grant
// from the onboarding prompt or the Profile toggle is visible everywhere at
// once, and an AppState watcher re-checks on foreground for the "user flipped
// it in system settings" path.

interface GrantedState {
  /** null until the first OS read completes. */
  granted: boolean | null;
}

const useGrantedStore = create<GrantedState>(() => ({ granted: null }));

/** Re-read the OS permission into the shared store. */
export async function refreshNotificationsGranted(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  useGrantedStore.setState({ granted });
  return granted;
}

/**
 * Raise the OS prompt if it is still allowed ("ask later"/undetermined), then
 * report the resulting grant. A hard "denied" never re-prompts — only system
 * settings can flip it, and we don't nag.
 */
export async function ensureNotificationsPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted && current.canAskAgain) {
    await Notifications.requestPermissionsAsync();
  }
  return refreshNotificationsGranted();
}

let watching = false;

/** Reactive OS grant (null while the first read is in flight). */
export function useNotificationsGranted(): boolean | null {
  const granted = useGrantedStore((s) => s.granted);
  useEffect(() => {
    if (watching) return;
    watching = true;
    void refreshNotificationsGranted();
    // Module-lifetime watcher, shared by every hook instance — never removed.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshNotificationsGranted();
    });
  }, []);
  return granted;
}
