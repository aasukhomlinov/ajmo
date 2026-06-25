import { addDays, parseISO, startOfDay } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';

import { MOCK_EVENTS } from '@/lib/mocks/events';
import type { CityId, Event } from '@/lib/types';

import { categoryLabel } from '../discover/categories';

// Client-side search over the mock fixture, scoped to the active city. Swapping
// to Supabase later means replacing MOCK_EVENTS with the query result and the
// `matchEvent` predicate with a server-side full-text query — the screen and the
// state machine below stay identical.

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

// "Popular this week": events in the active city starting within the next 7 days.
// Falls back to the soonest upcoming city events if the week is empty so the
// section is never blank.
function popularThisWeek(city: CityId): Event[] {
  const start = startOfDay(new Date());
  const end = addDays(start, 7);
  const cityEvents = MOCK_EVENTS.filter((e) => e.city === city).sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at),
  );
  const thisWeek = cityEvents.filter((e) => {
    const at = parseISO(e.starts_at);
    return at >= start && at < end;
  });
  return (thisWeek.length ? thisWeek : cityEvents).slice(0, POPULAR_LIMIT);
}

export function useSearch(city: CityId) {
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
    () =>
      settled
        ? MOCK_EVENTS.filter((e) => e.city === city && matchEvent(e, settled)).sort((a, b) =>
            a.starts_at.localeCompare(b.starts_at),
          )
        : [],
    [city, settled],
  );

  const popular = useMemo(() => popularThisWeek(city), [city]);

  const status: SearchStatus = !trimmed
    ? 'empty'
    : settled !== trimmed
      ? 'typing'
      : results.length
        ? 'results'
        : 'no-results';

  return { query, setQuery, status, results, popular };
}
