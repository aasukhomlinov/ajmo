import { useEffect } from 'react';

import { useSavedEvents } from '@/lib/api/events';
import { useSavedIdsQuery } from '@/lib/api/saves';
import {
  useLanguage,
  usePushEnabled,
  useReminderOffsets,
  useRemindersEnabled,
} from '@/lib/stores/settings';

import { useNotificationsGranted } from './permissions';
import { reconcileReminders } from './reminders';

/**
 * The single trigger point for reminder scheduling: mounted once at the root
 * while signed in, it re-reconciles the OS notification set whenever anything
 * it derives from changes — the saved list (save/unsave), the reminder
 * lead-times, the master push/reminder switches, the app language (copy is
 * baked into scheduled notifications), or the OS permission (grant in system
 * settings → reminders appear on next foreground via the AppState re-check).
 */
export function useReminderSync(active: boolean): void {
  const { data: savedIds } = useSavedIdsQuery();
  // Same query the Saved tab uses — shared cache, no extra fetch when both mount.
  const { data: events } = useSavedEvents(savedIds ?? []);
  const pushEnabled = usePushEnabled();
  const remindersEnabled = useRemindersEnabled();
  const offsets = useReminderOffsets();
  const language = useLanguage();
  const granted = useNotificationsGranted();

  useEffect(() => {
    if (!active || granted === null || savedIds === undefined) return;
    // Ids are in but their events haven't loaded yet (fresh save → new byIds
    // key): reconciling now would cancel still-valid reminders. Wait a tick;
    // the effect re-runs when the query lands.
    if (savedIds.length > 0 && events === undefined) return;

    const savedEvents = (events ?? []).filter((event) => savedIds.includes(event.id));
    void reconcileReminders(savedEvents, {
      enabled: granted && pushEnabled && remindersEnabled,
      offsets,
      language,
    });
  }, [active, granted, savedIds, events, pushEnabled, remindersEnabled, offsets, language]);
}
