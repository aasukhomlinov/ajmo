import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

// RN has no window focus events, so react-query never refetches on foreground
// unless focusManager is driven by AppState. Without this, a backgrounded app
// keeps stale starts_at in the cache forever — and the reminder reconcile
// (useReminderSync) would re-confirm reminders at an event time the nightly
// sweep has since moved.
AppState.addEventListener('change', (state) => {
  focusManager.setFocused(state === 'active');
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
    },
  },
});
