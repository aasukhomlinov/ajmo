import { addDays, parseISO, startOfDay } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';

import { useEvents } from '@/lib/api/events';
import type { CityId, Event } from '@/lib/types';

import { categoryLabel } from '../discover/categories';

// Client-side search over the city's upcoming events (fetched from Supabase via
// `useEvents`), scoped to the active city. A server-side full-text query can
// later replace the `matchEvent` predicate — the screen and the state machine
// below stay identical.

// Debounce so the skeleton (Search · Typing) is a real query delay, not a fake.
const DEBOUNCE_MS = 400;
// Handpicked "popular" stand-in size (real popularity ranking lands with the backend).
const POPULAR_LIMIT = 5;

export type SearchStatus = 'empty' | 'typing' | 'results' | 'no-results';

// Match on title / venue (name + address) / category — the fields a user is
// likely to type. Case-insensitive substring; `needle` is already trimmed.
function matchEvent(event: Event, needle: string): boolean {
  return (
    event.title.toLowerCase().includes(needle) ||
    event.venue.name.toLowerCase().includes(needle) ||
    event.venue.address.toLowerCase().includes(needle) ||
    event.category.includes(needle) ||
    categoryLabel(event.category).toLowerCase().includes(needle)
  );
}

// "Popular this week": events starting within the next 7 days. Falls back to the
// soonest upcoming events if the week is empty so the section is never blank.
function popularThisWeek(events: Event[]): Event[] {
  const start = startOfDay(new Date());
  const end = addDays(start, 7);
  const thisWeek = events.filter((e) => {
    const at = parseISO(e.starts_at);
    return at >= start && at < end;
  });
  return (thisWeek.length ? thisWeek : events).slice(0, POPULAR_LIMIT);
}

export function useSearch(city: CityId) {
  // Upcoming events for the city, already sorted soonest-first by the query.
  const { data } = useEvents(city);
  const events = useMemo(() => data ?? [], [data]);

  const [query, setQuery] = useState('');
  // The last query the debounce has "settled" on — drives results + the typing
  // state. While `settled !== trimmed` the query is still being typed.
  const [settled, setSettled] = useState('');
  const trimmed = query.trim().toLowerCase();

  useEffect(() => {
    // Clearing resets immediately (status is already 'empty' via `!trimmed`);
    // typing waits out the debounce so the skeleton state is a real query delay.
    const timer = setTimeout(() => setSettled(trimmed), trimmed ? DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [trimmed]);

  const results = useMemo(
    () => (settled ? events.filter((e) => matchEvent(e, settled)) : []),
    [events, settled],
  );

  const popular = useMemo(() => popularThisWeek(events), [events]);

  const status: SearchStatus = !trimmed
    ? 'empty'
    : settled !== trimmed
      ? 'typing'
      : results.length
        ? 'results'
        : 'no-results';

  return { query, setQuery, status, results, popular };
}
