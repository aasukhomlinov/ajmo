import { CalendarBlank, SlidersHorizontal, Tag } from 'phosphor-react-native';
import { StyleSheet, View } from 'react-native';

import { theme } from '@/lib/theme';
import { Chip } from '@/ui';

import { CATEGORY_META } from './categories';
import type { DateFilter, DiscoverFilters } from './useDiscoverFeed';

// Discover filter row (app frame node 177:978): three single-press filter chips
// over the mock data — category (tap to cycle), date range (tap to cycle), and a
// free-only toggle. Active = hard lime fill (Chip's active state). No backend.

const DATE_LABELS: Record<DateFilter, string> = {
  any: 'Any date',
  today: 'Today',
  week: 'This week',
};

export interface FilterBarProps {
  filters: DiscoverFilters;
  onCycleCategory: () => void;
  onCycleDate: () => void;
  onToggleFree: () => void;
}

export function FilterBar({
  filters,
  onCycleCategory,
  onCycleDate,
  onToggleFree,
}: FilterBarProps) {
  const categoryActive = filters.category !== 'all';
  const categoryLabel =
    filters.category === 'all' ? 'Category' : CATEGORY_META[filters.category].label;
  const categoryIcon =
    filters.category === 'all' ? SlidersHorizontal : CATEGORY_META[filters.category].icon;

  return (
    <View style={styles.row}>
      <Chip
        label={categoryLabel}
        leftIcon={categoryIcon}
        active={categoryActive}
        onPress={onCycleCategory}
      />
      <Chip
        label={DATE_LABELS[filters.date]}
        leftIcon={CalendarBlank}
        active={filters.date !== 'any'}
        onPress={onCycleDate}
      />
      <Chip
        label="Only free"
        leftIcon={Tag}
        active={filters.freeOnly}
        onPress={onToggleFree}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
});
