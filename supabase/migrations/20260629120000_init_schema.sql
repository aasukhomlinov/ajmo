-- Ajmo Phase 5 — core data schema.
--
-- Designed to accept BOTH rich events (venue channels: cover, description,
-- price) and sparse events (aggregators: only title/venue/time). Every optional
-- field is nullable so any source fits without a later schema change.
--
-- No geolocation in MVP (CLAUDE.md): cities carry no lat/lng; venues have
-- nullable lat/lng only to drive the Event Detail static map pin.

-- ── Enums ──────────────────────────────────────────────────────────────────
-- NOTE: 'sport' is intentionally absent from event_category (product decision).
create type public.event_category as enum (
  'music', 'party', 'art', 'food', 'cinema', 'theatre', 'market', 'other'
);

create type public.event_source_type as enum (
  'telegram', 'website', 'instagram', 'manual'
);

create type public.event_status as enum ('draft', 'published', 'hidden');

-- ── cities ─────────────────────────────────────────────────────────────────
-- Reference data. Two cities at launch (Belgrade, Novi Sad), chosen manually.
create table public.cities (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  country_code text not null default 'RS',
  slug         text not null unique,
  enabled      boolean not null default true
);

-- ── venues ─────────────────────────────────────────────────────────────────
create table public.venues (
  id         uuid primary key default gen_random_uuid(),
  city_id    uuid not null references public.cities (id) on delete restrict,
  name       text not null,
  slug       text not null,
  address    text,
  lat        double precision,
  lng        double precision,
  instagram  text,
  telegram   text,
  website    text,
  created_at timestamptz not null default now(),
  unique (city_id, slug)
);

create index venues_city_idx on public.venues (city_id);

-- ── events ─────────────────────────────────────────────────────────────────
-- covers[0] is the primary cover (the feed thumbnail). source_ref is the parser
-- dedup key (unique, nullable for manual entries).
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  city_id     uuid not null references public.cities (id) on delete restrict,
  venue_id    uuid not null references public.venues (id) on delete restrict,
  title       text not null,
  description text,
  category    public.event_category not null default 'other',
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  price_text  text,
  is_free     boolean not null default false,
  covers      text[],
  source_type public.event_source_type not null default 'manual',
  source_url  text,
  source_ref  text unique,
  status      public.event_status not null default 'published',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Dedup guard for the parser: one event per (venue, start, case-insensitive title).
create unique index events_dedup_idx
  on public.events (venue_id, starts_at, lower(title));

-- The hot feed query: published events for a city, ordered by start.
create index events_city_starts_idx
  on public.events (city_id, starts_at)
  where status = 'published';

-- Keep updated_at fresh on every row update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ── Auth-scoped tables ───────────────────────────────────────────────────────
-- Structure now; wired to real auth in a later phase. Saves and reminders are
-- user-scoped (not device-scoped) per CLAUDE.md.
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  language       text not null default 'en',
  active_city_id uuid references public.cities (id) on delete set null,
  created_at     timestamptz not null default now()
);

create table public.saves (
  user_id    uuid not null references auth.users (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index saves_event_idx on public.saves (event_id);

-- Per-event reminders at the user's lead-time prefs (one week / two days / one
-- day / day-of). send_at is the absolute fire time; sent_at marks delivery.
create table public.event_reminders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  event_id     uuid not null references public.events (id) on delete cascade,
  lead_minutes integer not null,
  send_at      timestamptz not null,
  sent_at      timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, event_id, lead_minutes)
);

create index event_reminders_due_idx
  on public.event_reminders (send_at)
  where sent_at is null;
