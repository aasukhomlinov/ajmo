import { addDays, format, parseISO, startOfDay } from 'date-fns';
import { useCallback, useMemo, useState } from 'react';

import { useEvents } from '@/lib/api/events';
import { dayKey, daySectionLabel, isMultiDay } from '@/lib/datetime';
import type { TranslationKey } from '@/lib/i18n';
import { belgradeStartOfDay, belgradeWeekday } from '@/lib/notifications/time';
import { useLanguage, type LanguageId } from '@/lib/stores/settings';
import type { CityId, Event, EventCategory } from '@/lib/types';

// Client-side feed state for Discover: filter selections + the derived,
// day-grouped sections fed to the SectionList. City-scoped, upcoming events come
// from Supabase via `useEvents(city)`; the category / date / free filters and the
// day grouping below run client-side over those rows.

export type DateFilter = 'any' | 'today' | 'this-weekend' | 'this-week';

export interface DiscoverFilters {
  /** Selected categories; empty means "all categories" (no category filter). */
  categories: EventCategory[];
  date: DateFilter;
  freeOnly: boolean;
}

/**
 * A feed entry. Multi-day events repeat under every day of their run, so the
 * SectionList key is per (day, event) — `id` alone would collide.
 */
export interface FeedItem extends Event {
  feedKey: string;
}

export interface EventSection {
  /** Day grouping key (yyyy-MM-dd), also the SectionList key. */
  key: string;
  /** Human header, e.g. "Friday, Jun 12". */
  title: string;
  data: FeedItem[];
}

// Radio label keys for the Date sheet, in display order (frame node 178:724).
// Render via t(DATE_OPTION_KEYS[option]).
export const DATE_OPTION_KEYS: Record<DateFilter, TranslationKey> = {
  any: 'date.any',
  today: 'date.today',
  'this-weekend': 'date.thisWeekend',
  'this-week': 'date.thisWeek',
};

export const DATE_OPTION_ORDER: DateFilter[] = ['any', 'today', 'this-weekend', 'this-week'];

const DEFAULT_FILTERS: DiscoverFilters = { categories: [], date: 'any', freeOnly: false };

/**
 * Half-open [start, end) window for a date preset, or null for "any". Day
 * boundaries are Europe/Belgrade calendar days (same convention as reminder
 * scheduling), not device-local. Past days are clamped off (start never
 * precedes today) so an upcoming-feed preset like "This week" doesn't surface
 * events that already happened earlier in the week.
 */
function dateRange(filter: DateFilter, now: Date): { start: Date; end: Date } | null {
  if (filter === 'any') return null;
  const todayStart = belgradeStartOfDay(now);
  // Days until the current Mon–Sun week's Sunday (0 when today is Sunday).
  const daysToSunday = (7 - belgradeWeekday(now)) % 7;
  const weekEnd = belgradeStartOfDay(now, daysToSunday + 1);
  switch (filter) {
    case 'today':
      return { start: todayStart, end: belgradeStartOfDay(now, 1) };
    case 'this-weekend':
      // Upcoming Saturday — or today, when already inside the weekend.
      return { start: belgradeStartOfDay(now, Math.max(daysToSunday - 1, 0)), end: weekEnd };
    case 'this-week':
      return { start: todayStart, end: weekEnd };
  }
}

/**
 * Range-aware preset match: the event's run [starts_at .. ends_at] (single-day
 * events collapse to their start instant) intersects the preset's half-open
 * Belgrade-tz window.
 */
function matchesDate(event: Event, filter: DateFilter, now: Date): boolean {
  const range = dateRange(filter, now);
  if (!range) return true;
  const startsAt = parseISO(event.starts_at);
  const endsAt = event.ends_at ? parseISO(event.ends_at) : startsAt;
  return startsAt < range.end && endsAt >= range.start;
}

// Multi-day events (exhibitions) repeat under every day of their run, capped
// this many days ahead so a months-long museum run doesn't manufacture a
// near-empty section for every day until it closes. A run opening beyond the
// cap still gets its opening-day entry; single-day events are never capped.
// ponytail: fixed 14-day horizon; revisit when the feed paginates or density
// feedback says otherwise.
const RANGED_EXPANSION_DAYS = 14;

function buildSections(
  events: Event[],
  filters: DiscoverFilters,
  lang: LanguageId,
): EventSection[] {
  const now = new Date();

  const filtered = events.filter(
    (e) =>
      (filters.categories.length === 0 || filters.categories.includes(e.category)) &&
      (!filters.freeOnly || e.is_free) &&
      matchesDate(e, filters.date, now),
  );

  const today = startOfDay(now);
  const horizon = addDays(today, RANGED_EXPANSION_DAYS - 1);
  // With a date preset active, ranged events may only land on days inside the
  // preset window — otherwise "Today" would still grow two weeks of sections.
  const presetRange = dateRange(filters.date, now);

  // Per day: the day's dated events first, ongoing exhibitions after them.
  const byDay = new Map<string, { timed: FeedItem[]; ongoing: FeedItem[] }>();
  const bucket = (key: string) => {
    let b = byDay.get(key);
    if (!b) {
      b = { timed: [], ongoing: [] };
      byDay.set(key, b);
    }
    return b;
  };

  for (const event of filtered) {
    if (!isMultiDay(event.starts_at, event.ends_at)) {
      const key = dayKey(event.starts_at);
      bucket(key).timed.push({ ...event, feedKey: `${key}:${event.id}` });
      continue;
    }

    const start = startOfDay(parseISO(event.starts_at));
    const end = startOfDay(parseISO(event.ends_at as string));
    let from = start > today ? start : today;
    let to = end < horizon ? end : horizon;
    if (presetRange) {
      const clipFrom = startOfDay(presetRange.start);
      const clipTo = startOfDay(new Date(presetRange.end.getTime() - 1));
      if (clipFrom > from) from = clipFrom;
      if (clipTo < to) to = clipTo;
    }
    if (from > to) {
      // Run opens beyond the horizon: keep a single opening-day entry.
      const key = dayKey(event.starts_at);
      bucket(key).ongoing.push({ ...event, feedKey: `${key}:${event.id}` });
      continue;
    }
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const key = format(d, 'yyyy-MM-dd');
      bucket(key).ongoing.push({ ...event, feedKey: `${key}:${event.id}` });
    }
  }

  return Array.from(byDay.keys())
    .sort()
    .map((key) => {
      const { timed, ongoing } = byDay.get(key) as { timed: FeedItem[]; ongoing: FeedItem[] };
      timed.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      // Exhibitions closing soonest first — "last chance" floats up.
      ongoing.sort((a, b) => (a.ends_at ?? '').localeCompare(b.ends_at ?? ''));
      return { key, title: daySectionLabel(key, lang), data: [...timed, ...ongoing] };
    });
}

export function useDiscoverFeed(city: CityId) {
  const [filters, setFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);

  // City-scoped, upcoming events from Supabase; filters/grouping run over them.
  const { data, isLoading, isError, refetch } = useEvents(city);

  // Day headers carry localized weekday/month words — rebuild on language change.
  const lang = useLanguage();
  const sections = useMemo(
    () => buildSections(data ?? [], filters, lang),
    [data, filters, lang],
  );

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
    isLoading,
    isError,
    refetch,
    setCategories,
    setDate,
    toggleFree,
    clearFilters,
  };
}
