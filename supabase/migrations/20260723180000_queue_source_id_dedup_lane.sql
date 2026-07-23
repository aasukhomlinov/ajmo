-- Scheduler re-key + dedup lane (pre-re-enable hardening).
--
-- 1. refresh_queue keys on SOURCE, not venue. The old refresh_enqueue
--    filtered `venue_id is not null` and the tick posted {"venue_id": …}, so
--    the two organizer sources (sources.venue_id IS NULL — aktivniklub,
--    synecdoche.cinema) silently never refreshed. parse-venue already accepts
--    {"source_id": …} for EVERY source (organizer or venue-backed), so the
--    queue now carries source_id and the tick always posts it. venue_id stays
--    (nullable) for debugging only. Venue↔enabled-source is 1:1 today —
--    parse-venue's maybeSingle() would break otherwise — so the backfill is
--    unambiguous.
-- 2. refresh_enqueue(p_kinds text[] default null) — optional lane filter so
--    IG (the only lane with per-run Apify cost) can run on its own cadence;
--    `select refresh_enqueue()` keeps working (null = all kinds).
-- 3. dedup lane: each enqueue adds TWO phase='dedup' rows (no source); the
--    tick orders them after ALL venue work and posts to dedup-events (it is
--    a post-translate reconciliation, never interleaved). Two rows
--    PERMANENTLY, not just first-run: merge chains (A←B, B←C) need a second
--    pass whenever they occur, and the second run is nearly free — cached
--    verdicts, no new hashes, no merges when nothing changed. A failed dedup
--    row never blocks the next cycle (the exists-check only sees
--    pending/running).

alter table public.refresh_queue
  add column if not exists source_id uuid references public.sources(id) on delete cascade;
alter table public.refresh_queue alter column venue_id drop not null;
alter table public.refresh_queue drop constraint refresh_queue_phase_check;
alter table public.refresh_queue add constraint refresh_queue_phase_check
  check (phase = any (array['extract', 'film', 'translate', 'covers', 'dedup']));

-- Backfill history rows from the venue's enabled source.
update public.refresh_queue q set source_id = s.id
from public.sources s
where q.source_id is null and s.venue_id = q.venue_id and s.enabled
  and s.kind in ('telegram', 'official', 'tickets', 'instagram');

-- The stale 'running' row left from the one-shot sweep (cron off since; its
-- pg_net response is long expired) settles as failed instead of confusing
-- the first re-enabled tick.
update public.refresh_queue set status = 'failed',
  last_error = 'stale running row settled during source_id re-key',
  updated_at = now()
where status = 'running';

-- History rows whose venue no longer maps to an enabled source: drop.
delete from public.refresh_queue where source_id is null;

-- Old zero-arg signature must go, or `select refresh_enqueue()` becomes
-- ambiguous against the new defaulted-arg version.
drop function if exists public.refresh_enqueue();

create or replace function public.refresh_enqueue(p_kinds text[] default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from refresh_queue where status in ('done','failed') and updated_at < now() - interval '14 days';
  with src as (
    select id as source_id, venue_id from sources
    where enabled
      and kind in ('telegram','official','tickets','instagram')
      and (p_kinds is null or kind = any (p_kinds))
      and handle <> 'dcloza'
  ), items as (
    select s.source_id, s.venue_id, p.phase
    from src s cross join (values ('extract'),('film'),('translate'),('covers')) p(phase)
  ), ins as (
    insert into refresh_queue (source_id, venue_id, phase)
    select i.source_id, i.venue_id, i.phase from items i
    where not exists (
      select 1 from refresh_queue q
      where q.source_id = i.source_id and q.phase = i.phase and q.status in ('pending','running')
    )
    returning 1
  ), ded as (
    insert into refresh_queue (source_id, venue_id, phase)
    select null::uuid, null::uuid, 'dedup' from generate_series(1, 2)
    where not exists (
      select 1 from refresh_queue q where q.phase = 'dedup' and q.status in ('pending','running')
    )
    returning 1
  )
  select (select count(*) from ins) + (select count(*) from ded) into n;
  return n;
end $$;

-- Body copied from 20260723120000_cron_ingest_hardening with three changes:
-- the pending ORDER BY pipelines per SOURCE (1:1 with venue) and sorts dedup
-- rows last, and the http_post body/url switch on the phase.
create or replace function public.refresh_tick() returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  resp record;
  nxt record;
begin
  for r in select * from refresh_queue where status = 'running' loop
    select status_code, content into resp from net._http_response where id = r.request_id;
    if found then
      if resp.status_code = 200
         and (resp.content like '%out of time budget%' or resp.content like '%re-run to resume%')
         and r.attempts < 4 then
        update refresh_queue set status = 'pending', attempts = attempts + 1,
          last_error = 'phase budget hit — resuming', updated_at = now() where id = r.id;
      elsif resp.status_code = 200 then
        update refresh_queue set status = 'done', last_error = null, updated_at = now() where id = r.id;
      elsif r.attempts < 3 then
        update refresh_queue set status = 'pending', attempts = attempts + 1,
          last_error = 'HTTP ' || coalesce(resp.status_code::text, 'timeout') || ': ' || coalesce(left(resp.content, 300), ''),
          updated_at = now() where id = r.id;
      else
        update refresh_queue set status = 'failed',
          last_error = 'HTTP ' || coalesce(resp.status_code::text, 'timeout') || ': ' || coalesce(left(resp.content, 300), ''),
          updated_at = now() where id = r.id;
      end if;
    elsif r.updated_at < now() - interval '5 minutes' then
      -- response never arrived (pg_net timeout/expiry); phases are idempotent → retry
      if r.attempts < 3 then
        update refresh_queue set status = 'pending', attempts = attempts + 1,
          last_error = 'no response', updated_at = now() where id = r.id;
      else
        update refresh_queue set status = 'failed', last_error = 'no response after retries',
          updated_at = now() where id = r.id;
      end if;
    end if;
  end loop;

  if exists (select 1 from refresh_queue where status = 'running') then return; end if;

  -- Per-source pipeline: a source's extract → film → translate → covers run
  -- back-to-back; dedup rows only ever start after every venue row settled
  -- (dedup is a post-translate reconciliation over the whole catalogue).
  select * into nxt from refresh_queue where status = 'pending'
  order by (phase = 'dedup')::int, source_id,
           case phase when 'extract' then 1 when 'film' then 2 when 'translate' then 3 else 4 end,
           id
  limit 1;
  if not found then return; end if;

  -- Anon (publishable) key — public by design, only passes the edge JWT gate.
  if nxt.phase = 'dedup' then
    update refresh_queue set status = 'running', updated_at = now(),
      request_id = net.http_post(
        url := 'https://kzyubtvevpfkwvrudtko.supabase.co/functions/v1/dedup-events',
        body := '{}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer sb_publishable_rsVczI5gfdYvmhyq1wY8GA_MIQ951dB'),
        timeout_milliseconds := 160000
      )
    where id = nxt.id;
  else
    update refresh_queue set status = 'running', updated_at = now(),
      request_id = net.http_post(
        url := 'https://kzyubtvevpfkwvrudtko.supabase.co/functions/v1/parse-venue',
        body := jsonb_build_object('source_id', nxt.source_id, 'phase', nxt.phase),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer sb_publishable_rsVczI5gfdYvmhyq1wY8GA_MIQ951dB'),
        timeout_milliseconds := 160000
      )
    where id = nxt.id;
  end if;
end $$;
