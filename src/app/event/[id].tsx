import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { EventDetailScreen } from '@/features/event/EventDetailScreen';
import { MOCK_EVENTS } from '@/lib/mocks/events';
import { EmptyState, Screen } from '@/ui';

// /event/[id] — opened from an EventCard in the Discover feed. Resolves the id
// against the mock feed via the shared Event type; swap MOCK_EVENTS for the
// Supabase query once it lands (the screen takes a plain Event, so this is the
// only line that changes).
export default function EventRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = MOCK_EVENTS.find((candidate) => candidate.id === id);

  if (!event) {
    return (
      <Screen padded contentContainerStyle={styles.notFound}>
        <EmptyState
          title="Event not found"
          description="This event may have ended or been removed."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return <EventDetailScreen event={event} />;
}

const styles = StyleSheet.create({
  notFound: {
    flex: 1,
    justifyContent: 'center',
  },
});
