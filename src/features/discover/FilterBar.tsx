import { CalendarBlank, SquaresFour, Tag } from 'phosphor-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { theme } from '@/lib/theme';
import type { EventCategory } from '@/lib/types';
import { Chip } from '@/ui';

import { CATEGORY_META } from './categories';
import { CategoryFilterSheet } from './CategoryFilterSheet';
import { DateFilterSheet } from './DateFilterSheet';
import { DATE_OPTION_LABELS, type DateFilter, type DiscoverFilters } from './useDiscoverFeed';

// Discover filter row (app frame node 177:978): a single horizontally-scrolling
// row of filter chips over the mock data — never wraps. Category + Date open
// bottom-sheets (multi-select grid / single preset); the free chip stays an
// inline toggle. A chip shows its active lime state — and a label reflecting the
// current selection — when a filter is set.

export interface FilterBarProps {
  filters: DiscoverFilters;
  onApplyCategories: (categories: EventCategory[]) => void;
  onApplyDate: (date: DateFilter) => void;
  onToggleFree: () => void;
}

export function FilterBar({
  filters,
  onApplyCategories,
  onApplyDate,
  onToggleFree,
}: FilterBarProps) {
  const [categorySheet, setCategorySheet] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);

  const categoryCount = filters.categories.length;
  const categoryLabel =
    categoryCount === 0
      ? 'Category'
      : categoryCount === 1
        ? CATEGORY_META[filters.categories[0]].label
        : `${categoryCount} categories`;

  const dateLabel = filters.date === 'any' ? 'Any date' : DATE_OPTION_LABELS[filters.date];

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <Chip
          label={categoryLabel}
          leftIcon={SquaresFour}
          active={categoryCount > 0}
          onPress={() => setCategorySheet(true)}
        />
        <Chip
          label={dateLabel}
          leftIcon={CalendarBlank}
          active={filters.date !== 'any'}
          onPress={() => setDateSheet(true)}
        />
        <Chip
          label="Only free"
          leftIcon={Tag}
          active={filters.freeOnly}
          onPress={onToggleFree}
        />
      </ScrollView>

      <CategoryFilterSheet
        visible={categorySheet}
        selected={filters.categories}
        onApply={onApplyCategories}
        onClose={() => setCategorySheet(false)}
      />
      <DateFilterSheet
        visible={dateSheet}
        selected={filters.date}
        onApply={onApplyDate}
        onClose={() => setDateSheet(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
});
