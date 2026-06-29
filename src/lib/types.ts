// Shared domain types. The Event shape mirrors the planned Supabase `events`
// table so mock data and the eventual server query are interchangeable — the
// feed never needs to know whether a row came from a fixture or Postgres.

/** City scope. Stored on the user's profile; every event/search query filters by it. */
export type CityId = 'belgrade' | 'novi-sad';

/** Language codes for localized event content (matches the profile language ids). */
export type LanguageCode = 'en' | 'ru' | 'sr';

/** Per-language strings for an event field; any language may be absent. */
export type LocalizedText = Partial<Record<LanguageCode, string>>;

/** Event taxonomy used by the category filter and the cover badge. */
export type EventCategory =
  | 'music'
  | 'party'
  | 'art'
  | 'food'
  | 'cinema'
  | 'theatre'
  | 'market';

export interface Venue {
  name: string;
  address: string;
  /**
   * Venue geolocation. Mirrors the future `venues.lat`/`venues.lng` columns.
   * Drives the Event Detail map snippet (a static placeholder + pin in MVP —
   * no maps SDK) and the "open in maps app" launcher.
   */
  lat: number;
  lng: number;
}

/**
 * One aggregated event. Field names + types match the future Supabase schema
 * (snake_case columns, ISO-8601 `timestamptz` for the time fields) so the
 * mock→Supabase swap is a query change, not a data-shape change.
 */
export interface Event {
  id: string;
  city: CityId;
  venue: Venue;
  /** Title resolved for the active language (falls back to any available language). */
  title: string;
  /** Description resolved for the active language (falls back to any available language). */
  description: string;
  /**
   * Raw per-language content, as stored. `title`/`description` above are the
   * resolved display strings; these carry every translation the source had
   * (used when re-resolving for a different language).
   */
  title_i18n?: LocalizedText;
  description_i18n?: LocalizedText;
  category: EventCategory;
  /** ISO-8601 instant. Start of the event. */
  starts_at: string;
  /** ISO-8601 instant. Optional — many listings only publish a start time. */
  ends_at?: string;
  /** Human-readable price as parsed from the source (e.g. "2500 RSD", "Free"). */
  price_text: string;
  is_free: boolean;
  /** Feed thumbnail / first gallery image. Always equals `covers[0]`. */
  cover_url: string;
  /**
   * Full cover gallery shown by the Event Detail carousel. Optional and
   * nullable-friendly (Supabase): when omitted the event is single-image and
   * only `cover_url` is used. When present, `covers[0] === cover_url`.
   */
  covers?: string[];
  /** Canonical link back to the venue / channel the event was parsed from. */
  source_url: string;
}
