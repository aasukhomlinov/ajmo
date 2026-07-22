-- Wire the film phase + instagram sources into the daily refresh scheduler.
-- Bodies copied from 20260720121636_daily_refresh_scheduler with ONLY:
--   * refresh_queue.phase CHECK gains 'film'
--   * refresh_enqueue(): source kind filter gains 'instagram'; phase cross
--     join gains ('film') — extract → film → translate → covers
--   * refresh_tick(): pending ORDER BY ranks film second
-- parse-venue is unchanged; phaseFilm already emits 're-run to resume' on a
-- budget hit, so the existing re-enqueue contract applies as-is.

-- 1) Allow 'film' in refresh_queue.phase (constraint name found, not assumed).
do $$
declare cname text;
begin
  select conname into strict cname from pg_constraint
  where conrelid = 'public.refresh_queue'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%phase%';
  execute format('alter table public.refresh_queue drop constraint %I', cname);
end $$;
alter table public.refresh_queue add constraint refresh_queue_phase_check
  check (phase in ('extract','film','translate','covers'));

-- 2) Enqueue: + instagram sources, + film phase.
create or replace function refresh_enqueue() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from refresh_queue where status in ('done','failed') and updated_at < now() - interval '14 days';
  with src as (
    select venue_id from sources
    where enabled and kind in ('telegram','official','tickets','instagram') and handle <> 'dcloza'
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

-- 3) Tick: film runs after extract, before translate.
create or replace function refresh_tick() returns void
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

  select * into nxt from refresh_queue where status = 'pending'
  order by case phase when 'extract' then 1 when 'film' then 2 when 'translate' then 3 else 4 end, id
  limit 1;
  if not found then return; end if;

  -- Anon (publishable) key — public by design, only passes the edge JWT gate.
  update refresh_queue set status = 'running', updated_at = now(),
    request_id = net.http_post(
      url := 'https://kzyubtvevpfkwvrudtko.supabase.co/functions/v1/parse-venue',
      body := jsonb_build_object('venue_id', nxt.venue_id, 'phase', nxt.phase),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer sb_publishable_rsVczI5gfdYvmhyq1wY8GA_MIQ951dB'),
      timeout_milliseconds := 160000
    )
  where id = nxt.id;
end $$;

-- Self-verify (printed by db push): live constraint + cron jobs.
do $$
declare j record; cdef text;
begin
  select pg_get_constraintdef(oid) into cdef from pg_constraint
  where conrelid = 'public.refresh_queue'::regclass and conname = 'refresh_queue_phase_check';
  raise notice '[scheduler] refresh_queue_phase_check: %', cdef;
  for j in select jobid, jobname, schedule, command, active from cron.job order by jobid loop
    raise notice '[scheduler] cron.job % "%": % | % | active=%', j.jobid, j.jobname, j.schedule, j.command, j.active;
  end loop;
exception when others then
  raise notice '[scheduler] verify readout failed (migration still applied): %', sqlerrm;
end $$;
