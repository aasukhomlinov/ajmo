-- Parser telemetry: LLM output that failed strict JSON parsing (parse-venue).
--
-- 'repair_needed'  — parsed only after a jsonrepair pass; run still succeeds.
--                    Frequency across venues tells us whether malformed output
--                    is systemic and worth a deeper fix.
-- 'unparseable'    — failed even after repair; the batch is NOT silently
--                    dropped: the phase run is marked failed and the raw
--                    snippet lands here for post-mortem.
create table public.ingest_errors (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid references public.venues (id) on delete cascade,
  phase         text not null,                    -- extract | translate | covers
  error_kind    text not null,                    -- repair_needed | unparseable
  error_message text,
  raw_output    text,                             -- first ~1k + last ~1k chars
  created_at    timestamptz not null default now()
);

create index ingest_errors_venue_idx on public.ingest_errors (venue_id, created_at desc);

-- Service-role only: RLS on, no policies (same as sources / ingest_runs).
alter table public.ingest_errors enable row level security;
