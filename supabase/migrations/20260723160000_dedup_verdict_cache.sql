-- Adjudication verdict cache: a grey-band pair judged DISTINCT would
-- otherwise re-pay a Haiku call on every dedup run (and a borderline pair
-- could flip verdicts between runs). One row per unordered pair; delete a
-- row to force re-adjudication after a pair's data changes materially.
create table public._dedup_verdicts (
  pair_key   text primary key,
  a          uuid not null,
  b          uuid not null,
  same_event boolean not null,
  confidence numeric not null,
  reason     text not null,
  created_at timestamptz not null default now()
);
alter table public._dedup_verdicts enable row level security;
