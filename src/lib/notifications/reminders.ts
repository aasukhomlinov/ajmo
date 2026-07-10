import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { translate, type TranslationKey } from '@/lib/i18n';
import type { LanguageId, ReminderOffset } from '@/lib/prefs';
import type { Event } from '@/lib/types';

import { belgradeDaysBefore, belgradeSameDayAt, belgradeTimeLabel } from './time';

// Local reminder scheduling for saved events (Phase 6).
//
// DESIGN: one declarative reconcile instead of schedule-on-save / cancel-on-
// unsave call sites. The desired notification set is a pure function of
// (saved events × reminder prefs × language × permission); reconcile() diffs
// it against what the OS actually has pending and cancels/schedules the
// difference. The OS pending list IS the bookkeeping: identifiers are
// deterministic (`reminder:<eventId>:<offset>`), so there is no local mirror
// to drift, and every trigger — save, unsave, prefs or language change,
// permission grant — funnels through the same code path. Notifications are
// device-local, so mirroring them to the DB would record state the server can
// neither enforce nor cancel; we deliberately keep event_reminders out of this.

const ID_PREFIX = 'reminder:';

export const REMINDERS_CHANNEL_ID = 'event-reminders';

// iOS keeps only the 64 soonest pending local notifications and silently drops
// the rest. Desired items are sorted by fire time and capped below that, so a
// heavy saver loses the FARTHEST reminders first — and a later reconcile (every
// app foreground re-runs one) re-schedules them once nearer ones have fired.
const MAX_SCHEDULED = 60;

// "Day of" reminders fire mid-morning Belgrade time, not at the event start.
const DAY_OF_HOUR = 10;

const OFFSET_DAYS: Record<Exclude<ReminderOffset, 'day_of'>, number> = {
  '1_week': 7,
  '2_days': 2,
  '1_day': 1,
};

const TITLE_KEYS: Record<ReminderOffset, TranslationKey> = {
  '1_week': 'notifications.oneWeekTitle',
  '2_days': 'notifications.twoDaysTitle',
  '1_day': 'notifications.oneDayTitle',
  day_of: 'notifications.dayOfTitle',
};

export interface ReminderSettings {
  /** Master gate: pushEnabled && remindersEnabled && OS permission granted. */
  enabled: boolean;
  offsets: ReminderOffset[];
  language: LanguageId;
}

interface DesiredReminder {
  identifier: string;
  eventId: string;
  title: string;
  body: string;
  fireAt: Date;
}

/** Fire instant for one (event, offset); null when it can't or shouldn't fire. */
function fireDate(startsAtIso: string | undefined, offset: ReminderOffset): Date | null {
  if (!startsAtIso) return null;
  const startsAt = new Date(startsAtIso);
  if (Number.isNaN(startsAt.getTime())) return null;
  const fireAt =
    offset === 'day_of'
      ? belgradeSameDayAt(startsAt, DAY_OF_HOUR)
      : belgradeDaysBefore(startsAt, OFFSET_DAYS[offset]);
  // A "day of" slot after the event started (morning events) is pointless.
  return fireAt.getTime() <= startsAt.getTime() ? fireAt : null;
}

function desiredReminders(events: Event[], settings: ReminderSettings, now: Date): DesiredReminder[] {
  if (!settings.enabled) return [];
  const out: DesiredReminder[] = [];
  for (const event of events) {
    for (const offset of settings.offsets) {
      const fireAt = fireDate(event.starts_at, offset);
      // Skip fire times already in the past (saving a tomorrow event must not
      // try the "one week before" slot; past events schedule nothing at all).
      if (!fireAt || fireAt.getTime() <= now.getTime()) continue;
      out.push({
        identifier: `${ID_PREFIX}${event.id}:${offset}`,
        eventId: event.id,
        title: translate(settings.language, TITLE_KEYS[offset], { title: event.title }),
        body: translate(settings.language, 'notifications.body', {
          venue: event.venue.name,
          time: belgradeTimeLabel(new Date(event.starts_at)),
        }),
        fireAt,
      });
    }
  }
  out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  return out.slice(0, MAX_SCHEDULED);
}

async function runReconcile(events: Event[], settings: ReminderSettings): Promise<void> {
  const desired = desiredReminders(events, settings, new Date());
  const desiredById = new Map(desired.map((item) => [item.identifier, item]));

  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const keep = new Set<string>();
  for (const request of pending) {
    if (!request.identifier.startsWith(ID_PREFIX)) continue; // not ours — leave alone
    const want = desiredById.get(request.identifier);
    const scheduledFireTs = (request.content.data as { fireTs?: number } | null)?.fireTs;
    // Keep only an exact match; content drift (language switch, event edit) or
    // a moved start time means cancel + schedule fresh below.
    if (
      want &&
      want.title === request.content.title &&
      want.body === request.content.body &&
      scheduledFireTs === want.fireAt.getTime()
    ) {
      keep.add(request.identifier);
    } else {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }

  for (const item of desired) {
    if (keep.has(item.identifier)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: item.identifier,
      content: {
        title: item.title,
        body: item.body,
        data: { eventId: item.eventId, fireTs: item.fireAt.getTime() },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.fireAt,
        ...(Platform.OS === 'android' ? { channelId: REMINDERS_CHANNEL_ID } : null),
      },
    });
  }
}

// Reconciles are serialized: a save-spam burst queues runs instead of
// interleaving getAll/cancel/schedule calls; the last run sees final state.
let chain: Promise<void> = Promise.resolve();

export function reconcileReminders(events: Event[], settings: ReminderSettings): Promise<void> {
  chain = chain
    .then(() => runReconcile(events, settings))
    .catch((error: unknown) => {
      // Scheduling is best-effort (e.g. the OS cap); the app must keep working.
      if (__DEV__) console.warn('[notifications] reconcile failed', error);
    });
  return chain;
}

/** Drop every reminder we own — called on sign-out so the next user starts clean. */
export function cancelAllReminders(): Promise<void> {
  return reconcileReminders([], { enabled: false, offsets: [], language: 'en' });
}
