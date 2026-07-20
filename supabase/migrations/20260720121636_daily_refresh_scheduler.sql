-- Daily refresh scheduler for parse-venue (per-venue, 3 phases, budget-resume).
--
-- Design: a small work queue drained one item at a time by a 2-minute pg_cron
-- ticker via pg_net. A phase whose response reports "out of time budget" /
-- "re-run to resume" (telegram chunk case, big translate/covers backlogs) is
-- RE-ENQUEUED instead of treated as done — that is the production-safety
-- requirement. Phases are idempotent (dedup index / i18n-null filter /
-- rehosted-cover filter), so retrying after an unknown outcome is always safe.
-- DC Loža is excluded — its parse-dcloza pipeline is separate.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table refresh_queue (
  id bigint generated always as identity primary key,
  venue_id uuid not null references venues(id) on delete cascade,
  phase text not null check (phase in ('extract','translate','covers')),
  status text not null default 'pending' check (status in ('pending','running','done','failed')),
  attempts int not null default 0,
  request_id bigint,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table refresh_queue enable row level security; -- no policies: service/cron only

-- Enqueue extract+translate+covers for every enabled parse-venue source.
-- Idempotent (skips venue+phase already pending/running); prunes old rows.
create or replace function refresh_enqueue() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from refresh_queue where status in ('done','failed') and updated_at < now() - interval '14 days';
  with src as (
    select venue_id from sources
    where enabled and kind in ('telegram','official','tickets') and handle <> 'dcloza'
  ), items as (
    select s.venue_id, p.phase
    from src s cross join (values ('extract'),('translate'),('covers')) p(phase)
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

-- One tick: settle the running item from net._http_response, then launch the
-- next pending one (concurrency 1; all extracts run before translates before
-- covers, so translations always see freshly extracted rows).
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
  order by case phase when 'extract' then 1 when 'translate' then 2 else 3 end, id
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

revoke execute on function refresh_enqueue() from public, anon, authenticated;
revoke execute on function refresh_tick() from public, anon, authenticated;

-- 02:00 UTC ≈ 04:00 Belgrade: enqueue the daily refresh; ticker drains it.
select cron.schedule('ajmo-refresh-enqueue', '0 2 * * *', $$select refresh_enqueue()$$);
select cron.schedule('ajmo-refresh-tick', '*/2 * * * *', $$select refresh_tick()$$);
