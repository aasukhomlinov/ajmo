import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cityHeaderLabel } from '@/lib/cities';
import { dateChipLabel, timeLabel } from '@/lib/datetime';
import { useSavedIdSet, useToggleSave } from '@/lib/api/saves';
import { useT } from '@/lib/i18n';
import { useActiveCity } from '@/lib/stores/city';
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
// the shared city store (set via the picker); save state is the user's Supabase
// saves query.

// Clearance so the last card scrolls clear of the floating glass TabBar capsule
// (≈48pt tall, sitting above the safe-area inset) instead of hiding behind it.
const TAB_BAR_SPACE = theme.spacing['5xl'] + theme.spacing.lg;
const SKELETON_COUNT = 5;

export function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();

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

  // Save state is the user-scoped Supabase query, shared with Event Detail and
  // the Saved screen. Toggling is optimistic — the check flips instantly and
  // rolls back if the write fails.
  const savedIds = useSavedIdSet();
  const toggleSave = useToggleSave();

  const renderItem = useCallback(
    ({ item }: { item: Event }) => (
      <View style={styles.cardWrap}>
        <EventCard
          title={item.title}
          venue={`${item.venue.name} · ${item.venue.address}`}
          time={timeLabel(item.starts_at, item.ends_at)}
          price={item.is_free ? t('event.free') : item.price_text}
          dateLabel={dateChipLabel(item.starts_at, t.lang)}
          category={categoryLabel(item.category, t)}
          imageUrl={item.cover_url}
          saved={savedIds.has(item.id)}
          onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.id } })}
          onToggleSave={() => toggleSave(item.id, savedIds.has(item.id))}
        />
      </View>
    ),
    [router, savedIds, toggleSave, t],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: EventSection }) => <ListSectionHeader title={section.title} />,
    [],
  );

  const contentStyle = { paddingBottom: insets.bottom + TAB_BAR_SPACE };

  return (
    <Screen>
      <DiscoverHeader
        cityLabel={cityHeaderLabel(activeCity, t)}
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
            title={t('discover.errorTitle')}
            description={t('common.connectionError')}
            actionLabel={t('common.retry')}
            onAction={() => refetch()}
          />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            title={t('discover.emptyTitle')}
            description={t('discover.emptyDescription')}
            actionLabel={t('discover.clearFilters')}
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
