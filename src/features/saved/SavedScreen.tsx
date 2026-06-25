import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MOCK_EVENTS } from '@/lib/mocks/events';
import { useSaves, useSavedIds } from '@/lib/stores/saves';
import { theme } from '@/lib/theme';
import type { Event } from '@/lib/types';
import { EmptyState, Header, Screen } from '@/ui';

import { SavedRow } from './SavedRow';

// Saved tab (app frames Saved 160:221 / Saved — Empty 166:300). A flat, shared
// list of the user's bookmarked events: Header "Saved" + a column of EventRow
// (the square-thumb single-line row), derived from the shared save store. Empty
// when nothing is saved. The list is NOT city-scoped — saves are a flat
// cross-city bookmark list (CLAUDE.md: "the Saved list is flat"), unlike the
// city-scoped Discover/Search feeds. Swap MOCK_EVENTS for the per-user Supabase
// query when auth lands; the store already holds the saved ids.

// Clearance so the last row scrolls clear of the floating glass TabBar capsule
// (mirrors DiscoverScreen).
const TAB_BAR_SPACE = theme.spacing['5xl'] + theme.spacing.lg;

export function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const savedIds = useSavedIds();
  const toggleSave = useSaves((s) => s.toggleSave);

  // Derive the saved events from the store, soonest-first (ISO strings sort
  // chronologically). Recomputes whenever the saved set changes, so unsaving an
  // event anywhere removes its row here.
  const savedEvents = useMemo(
    () =>
      MOCK_EVENTS.filter((event) => savedIds.has(event.id)).sort((a, b) =>
        a.starts_at.localeCompare(b.starts_at),
      ),
    [savedIds],
  );

  const openEvent = (id: string) =>
    router.push({ pathname: '/event/[id]', params: { id } });

  return (
    <Screen>
      <Header title="Saved" />

      {savedEvents.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            title="No saved events yet"
            description="Tap + on an event and it’ll show up here."
            actionLabel="Discover events"
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
              onDelete={() => toggleSave(item.id)}
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
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
  },
});
