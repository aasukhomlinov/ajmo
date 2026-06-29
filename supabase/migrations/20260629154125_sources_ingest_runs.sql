-- Ingestion sources + run log (Phase 5, session 2).
--
-- `sources` drives the parsers: one row per channel/site. `ingest_runs` records
-- each parser execution for observability. Both are service-role only (RLS on,
-- no policies) — the public app never reads them.

create table public.sources (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'telegram',          -- telegram | website | instagram
  handle      text not null unique,                       -- e.g. 'dcloza'
  url         text,                                        -- e.g. https://t.me/s/dcloza
  city_id     uuid not null references public.cities (id) on delete restrict,
  venue_id    uuid references public.venues (id) on delete set null,
  enabled     boolean not null default true,
  last_run_at timestamptz,
  created_at  timestamptz not null default now()
);

create table public.ingest_runs (
  id                uuid primary key default gen_random_uuid(),
  source_handle     text not null,
  found             integer not null default 0,
  inserted          integer not null default 0,
  skipped_digests   integer not null default 0,
  skipped_nonevents integer not null default 0,
  drafts            integer not null default 0,
  errors            integer not null default 0,
  error_detail      text,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz
);

create index ingest_runs_source_idx on public.ingest_runs (source_handle, started_at desc);

-- Service-role only: enable RLS, define no policies (denies anon/authenticated).
alter table public.sources     enable row level security;
alter table public.ingest_runs enable row level security;

-- Seed the DC Loża Telegram source (venue + city from the seed catalog).
insert into public.sources (kind, handle, url, city_id, venue_id, enabled)
select 'telegram', 'dcloza', 'https://t.me/s/dcloza', c.id, v.id, true
from public.cities c
join public.venues v on v.slug = 'dc-loza'
where c.slug = 'belgrade'
on conflict (handle) do nothing;
