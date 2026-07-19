-- Seed sources for the universal venue parser (parse-venue).
--
-- No new tables: `venues` + `sources` (init schema / sources_ingest_runs
-- migrations) already model venue metadata and parser feeds — the task's
-- proposed venues table maps onto them (source_url → sources.url,
-- source_type → sources.kind, is_active → sources.enabled,
-- last_parsed_at → sources.last_run_at).
--
-- sources.kind gains two values: 'official' (venue's own site) and
-- 'tickets' (ticketing platform page); both are parsed as HTML.

-- Kombank Dvorana was renamed mts Dvorana (same hall, Trg Nikole Pašića 5).
update public.venues
set name = 'mts Dvorana', slug = 'mts-dvorana'
where slug = 'kombank-dvorana';

-- Auditoria (Belgrade, Telegram-first venue) is new.
insert into public.venues (city_id, name, slug, telegram)
select c.id, 'Auditoria', 'auditoria', 'https://t.me/auditoria_belgrade'
from public.cities c
where c.slug = 'belgrade'
on conflict (city_id, slug) do nothing;

-- Three test sources for parse-venue.
insert into public.sources (kind, handle, url, city_id, venue_id, enabled)
select s.kind, s.handle, s.url, c.id, v.id, true
from (values
  ('official', 'domomladine',        'https://domomladine.org/kalendar/',        'dom-omladine-beograda'),
  ('tickets',  'mts-dvorana',        'https://tickets.rs/venue/mts_dvorana_21',  'mts-dvorana'),
  ('telegram', 'auditoria_belgrade', 'https://t.me/s/auditoria_belgrade',        'auditoria')
) as s(kind, handle, url, venue_slug)
join public.cities c on c.slug = 'belgrade'
join public.venues v on v.city_id = c.id and v.slug = s.venue_slug
on conflict (handle) do nothing;
