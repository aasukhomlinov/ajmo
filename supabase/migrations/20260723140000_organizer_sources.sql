-- Organizer sources: venue-less Instagram accounts (Aktivni Klub, Synecdoche)
-- announcing events that happen at rotating catalogued venues. sources.venue_id
-- stays nullable (a source needn't be a place), events.venue_id stays NOT NULL
-- (an event must be somewhere) — the extract model resolves the venue per event
-- from the injected catalogue, and events.city_id follows the resolved venue.

-- 1. New ledger outcome: an organizer post whose venue could not be resolved is
--    dropped and recorded as 'unresolved_venue'. It is NEVER skip-eligible —
--    the post re-extracts every sweep until its venue joins the catalogue.
alter table public.source_items drop constraint source_items_outcome_check;
alter table public.source_items add constraint source_items_outcome_check
  check (outcome in ('kept', 'recap', 'nonevent', 'dropped_invalid', 'error', 'unresolved_venue'));

-- 2. refresh_queue keys on venue_id (NOT NULL) and the ticker invokes
--    parse-venue by venue_id, so venue-less sources can't ride the queue.
--    Exclude them from the enqueue — otherwise a cron re-enable dies on a null
--    venue_id insert. Organizers run on-demand via {"source_id": ...} until the
--    queue learns to carry source ids.
create or replace function public.refresh_enqueue()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare n int;
begin
  delete from refresh_queue where status in ('done','failed') and updated_at < now() - interval '14 days';
  with src as (
    select venue_id from sources
    where enabled and venue_id is not null
      and kind in ('telegram','official','tickets','instagram') and handle <> 'dcloza'
  ), items as (
    select s.venue_id, p.phase
    from src s cross join (values ('extract'),('film'),('translate'),('covers')) p(phase)
  ), ins as (
    insert into refresh_queue (venue_id, phase)
    select i.venue_id, i.phase from items i
    where not exists (
      select 1 from refresh_queue q
      where q.venue_id = i.venue_id and q.phase = i.phase and q.status in ('pending','running')
    )
    returning 1
  ) select count(*) into n from ins;
  return n;
end $$;

-- 3. Seed the two organizer sources (city_id Belgrade is the source's home
--    base for bookkeeping only — event city follows the resolved venue).
insert into public.sources (kind, handle, url, city_id, venue_id, enabled)
select 'instagram', v.handle, v.url,
       (select id from public.cities where slug = 'belgrade'), null, true
from (values
  ('aktivniklub', 'https://www.instagram.com/aktivniklub/'),
  ('synecdoche.cinema', 'https://www.instagram.com/synecdoche.cinema/')
) as v(handle, url)
on conflict (handle) do nothing;
