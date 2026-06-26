import {
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useCallback, useMemo, useState } from 'react';

import { dayKey, daySectionLabel } from '@/lib/datetime';
import { MOCK_EVENTS } from '@/lib/mocks/events';
import type { CityId, Event, EventCategory } from '@/lib/types';

// Client-side feed state for Discover: filter selections + the derived,
// day-grouped sections fed to the SectionList. The data source is the mock
// fixture today; swapping to a Supabase query means replacing `MOCK_EVENTS`
// with the query result and keeping everything below identical.

export type DateFilter =
  | 'any'
  | 'today'
  | 'this-week'
  | 'next-week'
  | 'this-month'
  | 'next-month';

export interface DiscoverFilters {
  /** Selected categories; empty means "all categories" (no category filter). */
  categories: EventCategory[];
  date: DateFilter;
  freeOnly: boolean;
}

export interface EventSection {
  /** Day grouping key (yyyy-MM-dd), also the SectionList key. */
  key: string;
  /** Human header, e.g. "Friday, Jun 12". */
  title: string;
  data: Event[];
}

// Radio labels for the Date sheet, in display order (frame node 178:724).
export const DATE_OPTION_LABELS: Record<DateFilter, string> = {
  any: 'Any Time',
  today: 'Today',
  'this-week': 'This Week',
  'next-week': 'Next Week',
  'this-month': 'This Month',
  'next-month': 'Next Month',
};

export const DATE_OPTION_ORDER: DateFilter[] = [
  'any',
  'today',
  'this-week',
  'next-week',
  'this-month',
  'next-month',
];

const DEFAULT_FILTERS: DiscoverFilters = { categories: [], date: 'any', freeOnly: false };

/**
 * Inclusive [start, end] window for a date preset, or null for "any". Past days
 * are clamped off (start never precedes today) so an upcoming-feed preset like
 * "This week" doesn't surface events that already happened earlier in the week.
 */
function dateRange(filter: DateFilter, now: Date): { start: Date; end: Date } | null {
  const today = startOfDay(now);
  switch (filter) {
    case 'today':
      return { start: today, end: endOfDay(now) };
    case 'this-week':
      return { start: today, end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'next-week': {
      const d = addWeeks(now, 1);
      return { start: startOfWeek(d, { weekStartsOn: 1 }), end: endOfWeek(d, { weekStartsOn: 1 }) };
    }
    case 'this-month':
      return { start: today, end: endOfMonth(now) };
    case 'next-month': {
      const d = addMonths(now, 1);
      return { start: startOfMonth(d), end: endOfMonth(d) };
    }
    default:
      return null;
  }
}

function matchesDate(event: Event, filter: DateFilter, now: Date): boolean {
  const range = dateRange(filter, now);
  if (!range) return true;
  const startsAt = parseISO(event.starts_at);
  return startsAt >= range.start && startsAt <= range.end;
}

function buildSections(city: CityId, filters: DiscoverFilters): EventSection[] {
  const now = new Date();

  const filtered = MOCK_EVENTS.filter(
    (e) =>
      e.city === city &&
      (filters.categories.length === 0 || filters.categories.includes(e.category)) &&
      (!filters.freeOnly || e.is_free) &&
      matchesDate(e, filters.date, now),
  ).sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const byDay = new Map<string, Event[]>();
  for (const event of filtered) {
    const key = dayKey(event.starts_at);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(event);
    else byDay.set(key, [event]);
  }

  return Array.from(byDay, ([key, data]) => ({
    key,
    title: daySectionLabel(data[0].starts_at),
    data,
  }));
}

export function useDiscoverFeed(city: CityId) {
  const [filters, setFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);

  const sections = useMemo(() => buildSections(city, filters), [city, filters]);

  // The filter sheets commit a whole selection on "Apply"; the free chip stays
  // an inline toggle. Clearing resets every facet at once.
  const setCategories = useCallback(
    (categories: EventCategory[]) => setFilters((f) => ({ ...f, categories })),
    [],
  );
  const setDate = useCallback((date: DateFilter) => setFilters((f) => ({ ...f, date })), []);
  const toggleFree = useCallback(() => setFilters((f) => ({ ...f, freeOnly: !f.freeOnly })), []);
  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const isFiltered =
    filters.categories.length > 0 || filters.date !== 'any' || filters.freeOnly;

  return {
    filters,
    sections,
    isFiltered,
    setCategories,
    setDate,
    toggleFree,
    clearFilters,
  };
}
