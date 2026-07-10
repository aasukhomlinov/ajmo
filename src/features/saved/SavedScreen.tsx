import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSavedEvents } from '@/lib/api/events';
import { useSavedIdsQuery, useToggleSave } from '@/lib/api/saves';
import { useT } from '@/lib/i18n';
import { theme } from '@/lib/theme';
import type { Event } from '@/lib/types';
import { EmptyState, EventRowSkeleton, Header, Screen } from '@/ui';

import { SavedRow } from './SavedRow';

// Saved tab (app frames Saved 160:221 / Saved — Empty 166:300). A flat, shared
// list of the user's bookmarked events: Header "Saved" + a column of EventRow
// (the square-thumb single-line row). The saved ids come from the user-scoped
// Supabase saves query; the event rows themselves are resolved by id. The list
// is NOT city-scoped — saves are a flat cross-city bookmark list (CLAUDE.md:
// "the Saved list is flat"), unlike the city-scoped Discover/Search feeds.
// Swipe-to-delete unsaves through the same optimistic toggle as the feed card.

// Clearance so the last row scrolls clear of the floating glass TabBar capsule
// (mirrors DiscoverScreen).
const TAB_BAR_SPACE = theme.spacing['5xl'] + theme.spacing.lg;
const SKELETON_COUNT = 4;

export function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  const idsQuery = useSavedIdsQuery();
  const toggleSave = useToggleSave();

  // The saves query holds the ids; the rows are fetched from Supabase by id.
  const ids = useMemo(() => idsQuery.data ?? [], [idsQuery.data]);
  const { data, isLoading, isError, refetch } = useSavedEvents(ids);

  // Soonest-first (ISO strings sort chronologically). Recomputes whenever the
  // fetched rows change, so unsaving an event anywhere removes its row here.
  const savedEvents = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [data],
  );

  const openEvent = (id: string) =>
    router.push({ pathname: '/event/[id]', params: { id } });

  const hasSaves = ids.length > 0;

  return (
    <Screen>
      <Header title={t('saved.title')} />

      {idsQuery.isError || isError ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            title={t('saved.errorTitle')}
            description={t('common.connectionError')}
            actionLabel={t('common.retry')}
            onAction={() => {
              void idsQuery.refetch();
              void refetch();
            }}
          />
        </View>
      ) : idsQuery.isLoading || (hasSaves && isLoading) ? (
        <View style={styles.skeletons}>
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <EventRowSkeleton key={i} />
          ))}
        </View>
      ) : savedEvents.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            title={t('saved.emptyTitle')}
            description={t('saved.emptyDescription')}
            actionLabel={t('saved.discoverCta')}
            onAction={() => router.navigate('/discover')}
          />
        </View>
      ) : (
        <FlatList
          data={savedEvents}
          keyExtractor={(event) => event.id}
          renderItem={({ item }: { item: Event }) => (
            <SavedRow
              event={item}
              onPress={() => openEvent(item.id)}
              onDelete={() => toggleSave(item.id, true)}
            />
          )}
          ItemSeparatorComponent={Separator}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + TAB_BAR_SPACE },
          ]}
          style={styles.list}
        />
      )}
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  separator: {
    height: theme.spacing.md,
  },
  skeletons: {
    flex: 1,
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
  },
});
