-- One-off repair after the 2026-07-23 nightly-cron incident (reversible —
-- same pattern as 20260720113115_remove_seed_events).
--
-- 1) Snapshot every row this repair touches into _repair_20260723:
--    all parse-venue rows (source_ref is null covers the deleted duplicates,
--    the source_ref backfill targets, and the rows re-enriched afterwards).
-- 2) Delete 4 verified duplicate rows:
--    · Dorćol Platz "Дечји позоришни маратон" ×2 — BOTH copies came from the
--      recap post instagram.com/p/Da3UUgjFdfD/ ("…је званично почео"); under
--      the strict recap rule this post yields ZERO events, so neither copy
--      survives. The 4 plays from the announcement post Daka0-YDG1l stay.
--    · Bluz i Pivo "Jungle Leez & O.L.R." — same post (DbFuy05I74K) re-read
--      with a reworded title (Live Band / live bend); both enriched → keep
--      the earliest (652d8256).
--    · Karmakoma takeover — two posts announcing one event; both enriched →
--      keep the earliest (e85dba26, "Club Drugstore takes over Karmakoma").
-- 3) Backfill events.source_ref from source_url (post permalink / t.me post /
--    detail-page URL). Rows sharing one post URL get a '#<title-slug>'
--    discriminator — the slug expression MUST stay in sync with titleSlug()
--    in supabase/functions/parse-venue/index.ts. Collisions (same computed
--    ref twice, or a ref already taken) are skipped, not forced.

create table public._repair_20260723 as
  select now() as backed_up_at, e.* from public.events e where e.source_ref is null;

-- Service-role only, like the other ops tables.
alter table public._repair_20260723 enable row level security;

delete from public.events where id in (
  '0d565404-a08a-4220-be6e-2ceb5e485985', -- Dorćol recap copy (cron 07-23, no i18n)
  'dce70051-21b9-4634-8b92-72e15b8f3181', -- Dorćol recap copy (manual 07-22, enriched)
  'eef5ce14-b99e-405e-8c84-6032b7f2942c', -- Bluz i Pivo "– live bend" re-read
  '6e538f60-959d-4621-bcc9-83e3ad58f187'  -- Karmakoma "THIS SATURDAY" repost
);

with computed as (
  select e.id,
         e.source_url
           || case when count(*) over (partition by e.venue_id, e.source_url) > 1
              then '#' || left(replace(btrim(lower(regexp_replace(e.title, '[^[:alnum:]]+', ' ', 'g'))), ' ', '-'), 80)
              else '' end as ref
  from public.events e
  where e.source_ref is null
    and e.source_url is not null
    and e.source_type in ('telegram', 'instagram', 'website')
)
update public.events e
set source_ref = c.ref
from computed c
where e.id = c.id
  and (select count(*) from computed c2 where c2.ref = c.ref) = 1
  and not exists (select 1 from public.events x where x.source_ref = c.ref);

-- Self-verify readout (printed on apply).
do $$
declare backed int; remaining_null int; dups int;
begin
  select count(*) into backed from public._repair_20260723;
  select count(*) into remaining_null from public.events
    where source_ref is null and source_type in ('telegram','instagram','website');
  select count(*) into dups from (
    select 1 from public.events where source_ref is not null
    group by source_ref having count(*) > 1
  ) d;
  raise notice '[repair] backed up % rows; source_ref still null on % parser rows; duplicate refs: %',
    backed, remaining_null, dups;
end $$;
