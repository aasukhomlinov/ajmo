import { useQuery } from '@tanstack/react-query';
import { startOfDay } from 'date-fns';

import { supabase } from '@/lib/supabase';
import type { CityId, Event, EventCategory } from '@/lib/types';

// Supabase read layer for events (Phase 5 — replaces src/lib/mocks/events.ts as
// the live data source). Every row is mapped back into the shared `Event` shape
// so the feed/detail/search/saved screens are unchanged: a DB row and a fixture
// are interchangeable. Writes are not handled here — the client is anon/RLS and
// only SELECTs the public catalog (cities/venues/events).

// PostgREST projection. venues/cities are embedded via the events FKs (both NOT
// NULL → `!inner`, which is also what makes the city filter restrict the top
// rows rather than just nulling the embed).
const EVENT_SELECT = `
  id,
  title,
  description,
  category,
  starts_at,
  ends_at,
  price_text,
  is_free,
  covers,
  source_url,
  venues!inner ( name, address, lat, lng ),
  cities!inner ( slug )
` as const;

interface RawVenue {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

interface RawEventRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  starts_at: string;
  ends_at: string | null;
  price_text: string | null;
  is_free: boolean;
  covers: string[] | null;
  source_url: string | null;
  // A to-one embed is an object at runtime, but supabase-js (without generated
  // types) widens it to an array — accept either and unwrap.
  venues: RawVenue | RawVenue[] | null;
  cities: { slug: string } | { slug: string }[] | null;
}

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

/**
 * DB row → shared `Event`. Nullable source fields are coalesced to the
 * non-null shape the screens expect (the schema is nullable-friendly so sparse
 * aggregator events fit; seeded events are all rich). `cover_url` is covers[0];
 * `covers` is only set for true galleries (matches the fixture: single-image
 * events omit it and Event Detail falls back to [cover_url]).
 */
function mapEventRow(row: RawEventRow): Event {
  const venue = one(row.venues);
  const city = one(row.cities);
  const covers = row.covers ?? [];

  return {
    id: row.id,
    city: (city?.slug ?? 'belgrade') as CityId,
    venue: {
      name: venue?.name ?? '',
      address: venue?.address ?? '',
      lat: venue?.lat ?? 0,
      lng: venue?.lng ?? 0,
    },
    title: row.title,
    description: row.description ?? '',
    category: row.category as EventCategory,
    starts_at: row.starts_at,
    ends_at: row.ends_at ?? undefined,
    price_text: row.price_text ?? '',
    is_free: row.is_free,
    cover_url: covers[0] ?? '',
    covers: covers.length > 1 ? covers : undefined,
    source_url: row.source_url ?? '',
  };
}

export const eventKeys = {
  all: ['events'] as const,
  city: (city: CityId) => ['events', 'city', city] as const,
  detail: (id: string) => ['events', 'detail', id] as const,
  byIds: (ids: string[]) => ['events', 'byIds', ids] as const,
};

/** Published, upcoming events for a city, soonest first. City scope is a query param. */
async function fetchCityEvents(city: CityId): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('status', 'published')
    .eq('cities.slug', city)
    .gte('starts_at', startOfDay(new Date()).toISOString())
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return (data as unknown as RawEventRow[]).map(mapEventRow);
}

/** A single published event by id, or null when missing/hidden. */
async function fetchEventById(id: string): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('status', 'published')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapEventRow(data as unknown as RawEventRow) : null;
}

/**
 * Published events for a set of ids (the Saved list). Not city-scoped and not
 * upcoming-filtered — saves are a flat, cross-city bookmark list and may point
 * at events that have already started.
 */
async function fetchEventsByIds(ids: string[]): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('status', 'published')
    .in('id', ids);

  if (error) throw error;
  return (data as unknown as RawEventRow[]).map(mapEventRow);
}

/** Reactive feed source for a city. Discover/Search compose filters over this. */
export function useEvents(city: CityId) {
  return useQuery({
    queryKey: eventKeys.city(city),
    queryFn: () => fetchCityEvents(city),
  });
}

/** Reactive single-event query for the Event Detail route. */
export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: eventKeys.detail(id ?? ''),
    queryFn: () => fetchEventById(id as string),
    enabled: Boolean(id),
  });
}

/** Reactive lookup of the saved events. Disabled (no fetch) when nothing is saved. */
export function useSavedEvents(ids: string[]) {
  // Stable key regardless of insertion order so re-saving doesn't refetch.
  const sorted = [...ids].sort();
  return useQuery({
    queryKey: eventKeys.byIds(sorted),
    queryFn: () => fetchEventsByIds(sorted),
    enabled: sorted.length > 0,
  });
}
