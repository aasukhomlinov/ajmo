import { addDays, parseISO, startOfDay } from 'date-fns';
import { useCallback, useMemo, useState } from 'react';

import { dayKey, daySectionLabel, isSameLocalDay } from '@/lib/datetime';
import { MOCK_EVENTS } from '@/lib/mocks/events';
import type { CityId, Event, EventCategory } from '@/lib/types';

// Client-side feed state for Discover: filter selections + the derived,
// day-grouped sections fed to the SectionList. The data source is the mock
// fixture today; swapping to a Supabase query means replacing `MOCK_EVENTS`
// with the query result and keeping everything below identical.

export type CategoryFilter = EventCategory | 'all';
export type DateFilter = 'any' | 'today' | 'week';

export interface DiscoverFilters {
  category: CategoryFilter;
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

const DEFAULT_FILTERS: DiscoverFilters = { category: 'all', date: 'any', freeOnly: false };

// Tap-to-cycle orders for the single-press filter chips.
const CATEGORY_ORDER: CategoryFilter[] = [
  'all',
  'music',
  'party',
  'art',
  'food',
  'cinema',
  'theatre',
  'market',
];
const DATE_ORDER: DateFilter[] = ['any', 'today', 'week'];

function next<T>(order: readonly T[], current: T): T {
  const i = order.indexOf(current);
  return order[(i + 1) % order.length];
}

function matchesDate(event: Event, filter: DateFilter, now: Date): boolean {
  if (filter === 'any') return true;
  if (filter === 'today') return isSameLocalDay(event.starts_at, now);
  // 'week' — starts within the next 7 days (today inclusive).
  const start = startOfDay(now);
  const startsAt = parseISO(event.starts_at);
  return startsAt >= start && startsAt < addDays(start, 7);
}

function buildSections(city: CityId, filters: DiscoverFilters): EventSection[] {
  const now = new Date();

  const filtered = MOCK_EVENTS.filter(
    (e) =>
      e.city === city &&
      (filters.category === 'all' || e.category === filters.category) &&
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

  const cycleCategory = useCallback(
    () => setFilters((f) => ({ ...f, category: next(CATEGORY_ORDER, f.category) })),
    [],
  );
  const cycleDate = useCallback(
    () => setFilters((f) => ({ ...f, date: next(DATE_ORDER, f.date) })),
    [],
  );
  const toggleFree = useCallback(() => setFilters((f) => ({ ...f, freeOnly: !f.freeOnly })), []);
  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const isFiltered =
    filters.category !== 'all' || filters.date !== 'any' || filters.freeOnly;

  return {
    filters,
    sections,
    isFiltered,
    cycleCategory,
    cycleDate,
    toggleFree,
    clearFilters,
  };
}
