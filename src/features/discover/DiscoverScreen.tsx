import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cityHeaderLabel } from '@/lib/cities';
import { dateChipLabel, timeLabel } from '@/lib/datetime';
import { useActiveCity } from '@/lib/stores/city';
import { useSaves, useSavedIds } from '@/lib/stores/saves';
import { theme } from '@/lib/theme';
import type { Event } from '@/lib/types';
import { EmptyState, EventCardSkeleton, ListSectionHeader, Screen } from '@/ui';

import { categoryLabel } from './categories';
import { DiscoverHeader } from './DiscoverHeader';
import { EventCard } from './EventCard';
import { FilterBar } from './FilterBar';
import { useDiscoverFeed, type EventSection } from './useDiscoverFeed';

// Discover feed — the populated list (frame 177:832), the no-match empty state
// (272:1353) and the skeleton loading state (273:1388). City scope comes from
// the shared city store (set via the picker); save state is local-only for now.

// Clearance so the last card scrolls clear of the floating glass TabBar capsule
// (≈48pt tall, sitting above the safe-area inset) instead of hiding behind it.
const TAB_BAR_SPACE = theme.spacing['5xl'] + theme.spacing.lg;
const SKELETON_COUNT = 5;

export function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // City scope drives the feed query + the header pill; switching it in the
  // picker re-derives the sections (useDiscoverFeed memoizes on city).
  const activeCity = useActiveCity();

  const {
    filters,
    sections,
    isLoading,
    isError,
    refetch,
    setCategories,
    setDate,
    toggleFree,
    clearFilters,
  } = useDiscoverFeed(activeCity);

  // Save state now lives in the shared store so the feed, Event Detail and the
  // Saved screen all reflect the same set (CLAUDE.md: saves are per-user; the
  // store swaps to a Supabase mutation later).
  const savedIds = useSavedIds();
  const toggleSave = useSaves((s) => s.toggleSave);

  const renderItem = useCallback(
    ({ item }: { item: Event }) => (
      <View style={styles.cardWrap}>
        <EventCard
          title={item.title}
          venue={`${item.venue.name} · ${item.venue.address}`}
          time={timeLabel(item.starts_at, item.ends_at)}
          price={item.price_text}
          dateLabel={dateChipLabel(item.starts_at)}
          category={categoryLabel(item.category)}
          imageUrl={item.cover_url}
          saved={savedIds.has(item.id)}
          onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.id } })}
          onToggleSave={() => toggleSave(item.id)}
        />
      </View>
    ),
    [router, savedIds, toggleSave],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: EventSection }) => <ListSectionHeader title={section.title} />,
    [],
  );

  const contentStyle = { paddingBottom: insets.bottom + TAB_BAR_SPACE };

  return (
    <Screen>
      <DiscoverHeader
        cityLabel={cityHeaderLabel(activeCity)}
        onCityPress={() => router.push('/city')}
        onSearchPress={() => router.push('/search')}
      />

      {isLoading ? (
        <View style={[styles.skeletons, contentStyle]}>
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </View>
      ) : isError ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Couldn’t load events"
            description="Check your connection and try again."
            actionLabel="Retry"
            onAction={() => refetch()}
          />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            title="No events match"
            description="Try clearing a filter or widening the dates — new events are added daily."
            actionLabel="Clear filters"
            onAction={clearFilters}
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          ListHeaderComponent={
            <View style={styles.filterWrap}>
              <FilterBar
                filters={filters}
                onApplyCategories={setCategories}
                onApplyDate={setDate}
                onToggleFree={toggleFree}
              />
            </View>
          }
          ItemSeparatorComponent={ItemSeparator}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={contentStyle}
          style={styles.list}
        />
      )}
    </Screen>
  );
}

function ItemSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  filterWrap: {
    // No horizontal padding here: the FilterBar is a full-width horizontal
    // ScrollView that owns its own side padding (so chips scroll edge to edge).
    paddingTop: theme.spacing.lg,
  },
  cardWrap: {
    paddingHorizontal: theme.spacing.lg,
  },
  separator: {
    height: theme.spacing.md,
  },
  skeletons: {
    flex: 1,
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
  },
});
