-- Remove the seed/test catalog events so the app ships only parser-ingested
-- events. Classification signal: seed_catalog stamped every seeded event with
-- source_ref 'seed:<id>'; parser rows are source_ref NULL (parse-venue) or
-- 'dcloza:%' (parse-dcloza). Venues/sources are untouched.
--
-- Reversible: deleted rows are copied to _removed_seed_events first
-- (service-role only). Restore = insert into events select * from it.

create table public._removed_seed_events as
  select * from public.events where source_ref like 'seed:%';

alter table public._removed_seed_events enable row level security;

delete from public.events where source_ref like 'seed:%';
