-- Backfill the missing address for Auditoria (seeded without one in
-- 20260719120000_seed_parse_venue_sources). Guarded, so a manually-set
-- address is never overwritten and re-runs are no-ops.

update public.venues
set address = 'Vojvode Dobrnjca 48'
where slug = 'auditoria'
  and (address is null or btrim(address) = '');
