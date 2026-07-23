-- Cron-path hardening after the 2026-07-23 nightly incident.
--
-- What went wrong that night (see also parse-venue changes deployed with this):
--  1. Anthropic credits ran dry mid-run; every translate batch failed with a
--     400 — but parse-venue returned HTTP 200, so refresh_tick marked the
--     items `done` and they were never retried after the top-up. parse-venue
--     now returns 500 on real (non-budget-resume) errors, which the tick
--     already retries ≤3× and then records as failed with last_error.
--  2. The tick drained the queue globally phase-by-phase (ALL extracts, then
--     all films, translates, covers) at one item / 2 min — with ~80 sources,
--     covers started ~8h after the first extract, so fresh IG events sat all
--     morning with expiring cdninstagram cover URLs and no i18n. The pending
--     ORDER BY now pipelines PER VENUE: each venue runs
--     extract → film → translate → covers back-to-back (~8 min), while the
--     phase rank still guarantees ordering within a venue. No cross-venue
--     dependency exists between phases, so global phase barriers bought
--     nothing but latency.
--
-- Also: ingest_runs gains skipped_recap — the strict recap rule (recap posts
-- create NO events) is counted per extract run, distinct from
-- skipped_nonevents, so the cost of strict mode stays observable per venue.

alter table public.ingest_runs add column if not exists skipped_recap int;

-- Body copied from 20260722180000_scheduler_film_instagram with ONLY the
-- pending ORDER BY changed (venue first, then phase rank).
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

  -- Per-venue pipeline: a venue's extract → film → translate → covers run
  -- back-to-back, so its events are fully enriched minutes after extraction
  -- instead of hours (global phase barriers caused the 2026-07-23 morning of
  -- untranslated events with expiring IG cover URLs).
  select * into nxt from refresh_queue where status = 'pending'
  order by venue_id,
           case phase when 'extract' then 1 when 'film' then 2 when 'translate' then 3 else 4 end,
           id
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
