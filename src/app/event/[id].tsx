import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { EventDetailScreen } from '@/features/event/EventDetailScreen';
import { useEvent } from '@/lib/api/events';
import { useT } from '@/lib/i18n';
import { EmptyState, EventCardSkeleton, Screen } from '@/ui';

// /event/[id] — opened from an EventCard in the feed (or a Saved row). Resolves
// the id against Supabase via useEvent; the screen takes a plain Event so it is
// agnostic to the data source. Shows a skeleton while loading and an EmptyState
// when the event is missing or the fetch fails.
export default function EventRoute() {
  const router = useRouter();
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event, isLoading, isError } = useEvent(id);

  if (isLoading) {
    return (
      <Screen padded contentContainerStyle={styles.loading}>
        <EventCardSkeleton />
      </Screen>
    );
  }

  if (isError || !event) {
    return (
      <Screen padded contentContainerStyle={styles.notFound}>
        <EmptyState
          title={isError ? t('event.errorTitle') : t('event.notFoundTitle')}
          description={isError ? t('common.connectionError') : t('event.notFoundDescription')}
          actionLabel={t('common.goBack')}
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return <EventDetailScreen event={event} />;
}

const styles = StyleSheet.create({
  loading: {
    paddingTop: 24,
  },
  notFound: {
    flex: 1,
    justifyContent: 'center',
  },
});
