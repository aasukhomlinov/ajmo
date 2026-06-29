-- Fix seed event times: anchor to Belgrade wall-clock, not UTC.
--
-- The seed computed starts_at/ends_at from date_trunc('day', now()) — i.e. UTC
-- midnight — so a fixture meant for 18:00 local was stored as 18:00 UTC and
-- rendered 18:00+offset (20:00 CEST) in the app, with late-night events spilling
-- into the next day and skewing the day grouping. The app formats times in the
-- device's local zone, and the two launch cities are both Europe/Belgrade.
--
-- Re-stamp: take the stored wall-clock components (read in UTC) and re-interpret
-- them in Europe/Belgrade, so 18:00 stays 18:00 for a Belgrade user. DST-safe
-- (uses the named zone, not a fixed ±2h). Scoped to the seed rows.
update public.events
set
  starts_at = (starts_at at time zone 'UTC') at time zone 'Europe/Belgrade',
  ends_at = case
    when ends_at is null then null
    else (ends_at at time zone 'UTC') at time zone 'Europe/Belgrade'
  end
where source_ref like 'seed:%';
