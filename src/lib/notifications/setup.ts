import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { REMINDERS_CHANNEL_ID } from './reminders';

// One-time expo-notifications wiring (called at module scope from the root
// layout, like SplashScreen.preventAutoHideAsync): foreground presentation +
// the Android channel. Reminders stay visible with the app open — banner and
// notification list, but no sound in the foreground.
export function initNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(REMINDERS_CHANNEL_ID, {
      name: 'Event reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/**
 * Tapping a reminder opens that event's detail screen. The hook covers both a
 * warm tap (app in background) and a cold launch from the notification —
 * useLastNotificationResponse spans both — and waits for `ready` (root gate
 * open: signed in + onboarded) so the push lands on a mountable route.
 */
export function useNotificationDeepLink(ready: boolean): void {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  // The last response object persists across re-renders; navigate once per tap.
  const handledDate = useRef<number | null>(null);

  useEffect(() => {
    if (!ready || !response || handledDate.current === response.notification.date) return;
    handledDate.current = response.notification.date;
    const { eventId } = (response.notification.request.content.data ?? {}) as {
      eventId?: unknown;
    };
    if (typeof eventId === 'string') {
      router.push({ pathname: '/event/[id]', params: { id: eventId } });
    }
  }, [ready, response, router]);
}
