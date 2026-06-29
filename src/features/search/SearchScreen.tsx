import { useRouter } from 'expo-router';
import { MagnifyingGlass, XCircle } from 'phosphor-react-native';
import { useCallback } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { dateChipLabel } from '@/lib/datetime';
import { useActiveCity } from '@/lib/stores/city';
import { theme } from '@/lib/theme';
import type { Event } from '@/lib/types';
import { Chip, EmptyState, EventRowSkeleton, Header, Input, Screen, Text } from '@/ui';

import { EventRow } from '../discover/EventRow';
import { useRecentSearches } from './useRecentSearches';
import { useSearch } from './useSearch';

// Search screen (frames 185:603 / 187:674 / 189:711 / 190:803). A focused search
// field over a state machine: empty (recent + popular) → typing (skeletons) →
// results (EventRow list) / no-results (EmptyState). Searches the city's upcoming
// events from Supabase (via useSearch → useEvents), scoped to the active city;
// recent searches are local-only. A compact Header (back + centered "Search")
// sits above the field in every state: the back arrow exits to Discover, while
// the in-field clear (X) only clears the query.

// Search · Typing shows three loading rows.
const SKELETON_COUNT = 3;

export function SearchScreen() {
  const router = useRouter();
  const activeCity = useActiveCity();
  const { query, setQuery, status, results, popular } = useSearch(activeCity);
  const { recent, addRecent } = useRecentSearches();

  const openEvent = useCallback(
    (id: string) => router.push({ pathname: '/event/[id]', params: { id } }),
    [router],
  );

  // Persist the query, then open — covers the "tap a result" path in addition to
  // pressing the keyboard search key.
  const openResult = useCallback(
    (id: string) => {
      addRecent(query);
      openEvent(id);
    },
    [addRecent, query, openEvent],
  );

  const renderRow = useCallback(
    (event: Event, onPress: () => void) => (
      <EventRow
        key={event.id}
        title={event.title}
        venue={event.venue.name}
        date={dateChipLabel(event.starts_at)}
        imageUrl={event.cover_url}
        onPress={onPress}
      />
    ),
    [],
  );

  return (
    <Screen>
      <Header title="Search" variant="compact" onBack={() => router.back()} />
      <View style={styles.searchBar}>
        <Input
          type="text"
          value={query}
          onChangeText={setQuery}
          placeholder="Search events, venues..."
          autoFocus
          returnKeyType="search"
          onSubmitEditing={() => addRecent(query)}
          leftIcon={<MagnifyingGlass size={ICON_SIZE} color={theme.colors.text.secondary} />}
          rightIcon={
            query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <XCircle size={ICON_SIZE} color={theme.colors.text.secondary} />
              </Pressable>
            ) : undefined
          }
        />
      </View>

      {status === 'empty' ? (
        <ScrollView
          contentContainerStyle={styles.emptyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {recent.length > 0 ? (
            <View style={styles.section}>
              <Text variant="sectionHeader" color={theme.colors.text.secondary}>
                Recent searches
              </Text>
              <View style={styles.chips}>
                {recent.map((q) => (
                  <Chip key={q} label={q} uppercase={false} onPress={() => setQuery(q)} />
                ))}
              </View>
            </View>
          ) : null}

          {popular.length > 0 ? (
            <View style={styles.section}>
              <Text variant="sectionHeader" color={theme.colors.text.secondary}>
                Popular this week
              </Text>
              <View style={styles.list}>
                {popular.map((event) => renderRow(event, () => openEvent(event.id)))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      ) : status === 'typing' ? (
        <View style={styles.typingContent}>
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <EventRowSkeleton key={i} />
          ))}
        </View>
      ) : status === 'results' ? (
        <FlatList
          style={styles.flex}
          data={results}
          keyExtractor={(event) => event.id}
          renderItem={({ item }) => renderRow(item, () => openResult(item.id))}
          ListHeaderComponent={
            <Text variant="sectionHeader" color={theme.colors.text.secondary} style={styles.count}>
              {`${results.length} result${results.length === 1 ? '' : 's'}`}
            </Text>
          }
          ItemSeparatorComponent={Separator}
          contentContainerStyle={styles.resultsContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.noResults}>
          <EmptyState
            title="No results"
            description={`Nothing matches “${query.trim()}”. Try a broader search or browse all events.`}
            actionLabel="Browse all events"
            onAction={() => router.back()}
          />
        </View>
      )}
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const ICON_SIZE = 20;

const styles = StyleSheet.create({
  searchBar: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  flex: {
    flex: 1,
  },
  emptyContent: {
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing['4xl'],
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  list: {
    gap: theme.spacing.md,
  },
  typingContent: {
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  resultsContent: {
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing['4xl'],
  },
  count: {
    marginBottom: theme.spacing.lg,
  },
  separator: {
    height: theme.spacing.md,
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
  },
});
