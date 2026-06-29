import { useQuery } from '@tanstack/react-query';
import { startOfDay } from 'date-fns';

import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/stores/settings';
import type { CityId, Event, EventCategory, LanguageCode, LocalizedText } from '@/lib/types';

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
  title_i18n,
  description_i18n,
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

// Order in which to look for a usable translation when the active language is
// missing. Mirrors the profile language catalog.
const LANGUAGE_FALLBACK_ORDER: LanguageCode[] = ['en', 'ru', 'sr'];

/** Pick the active language's text, else any available language, else the scalar fallback. */
function localize(i18n: LocalizedText | null, lang: LanguageCode, fallback: string): string {
  if (i18n) {
    const chosen = i18n[lang];
    if (chosen) return chosen;
    for (const code of LANGUAGE_FALLBACK_ORDER) {
      const value = i18n[code];
      if (value) return value;
    }
  }
  return fallback;
}

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
  title_i18n: LocalizedText | null;
  description_i18n: LocalizedText | null;
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
function mapEventRow(row: RawEventRow, lang: LanguageCode): Event {
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
    title: localize(row.title_i18n, lang, row.title),
    description: localize(row.description_i18n, lang, row.description ?? ''),
    title_i18n: row.title_i18n ?? undefined,
    description_i18n: row.description_i18n ?? undefined,
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

// Keys carry the active language so switching it re-resolves content (the rows
// are the same; only the localized title/description differ).
export const eventKeys = {
  all: ['events'] as const,
  city: (city: CityId, lang: LanguageCode) => ['events', 'city', city, lang] as const,
  detail: (id: string, lang: LanguageCode) => ['events', 'detail', id, lang] as const,
  byIds: (ids: string[], lang: LanguageCode) => ['events', 'byIds', ids, lang] as const,
};

/** Published, upcoming events for a city, soonest first. City scope is a query param. */
async function fetchCityEvents(city: CityId, lang: LanguageCode): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('status', 'published')
    .eq('cities.slug', city)
    .gte('starts_at', startOfDay(new Date()).toISOString())
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return (data as unknown as RawEventRow[]).map((row) => mapEventRow(row, lang));
}

/** A single published event by id, or null when missing/hidden. */
async function fetchEventById(id: string, lang: LanguageCode): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('status', 'published')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapEventRow(data as unknown as RawEventRow, lang) : null;
}

/**
 * Published events for a set of ids (the Saved list). Not city-scoped and not
 * upcoming-filtered — saves are a flat, cross-city bookmark list and may point
 * at events that have already started.
 */
async function fetchEventsByIds(ids: string[], lang: LanguageCode): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('status', 'published')
    .in('id', ids);

  if (error) throw error;
  return (data as unknown as RawEventRow[]).map((row) => mapEventRow(row, lang));
}

/** Reactive feed source for a city, in the active language. Discover/Search compose filters over this. */
export function useEvents(city: CityId) {
  const lang = useLanguage();
  return useQuery({
    queryKey: eventKeys.city(city, lang),
    queryFn: () => fetchCityEvents(city, lang),
  });
}

/** Reactive single-event query for the Event Detail route. */
export function useEvent(id: string | undefined) {
  const lang = useLanguage();
  return useQuery({
    queryKey: eventKeys.detail(id ?? '', lang),
    queryFn: () => fetchEventById(id as string, lang),
    enabled: Boolean(id),
  });
}

/** Reactive lookup of the saved events. Disabled (no fetch) when nothing is saved. */
export function useSavedEvents(ids: string[]) {
  const lang = useLanguage();
  // Stable key regardless of insertion order so re-saving doesn't refetch.
  const sorted = [...ids].sort();
  return useQuery({
    queryKey: eventKeys.byIds(sorted, lang),
    queryFn: () => fetchEventsByIds(sorted, lang),
    enabled: sorted.length > 0,
  });
}
