-- Pre-extract cost ledger: one row per processed source item (IG/TG post or
-- venue page). Repeat sweeps skip items whose content hash is unchanged
-- instead of re-sending them to Sonnet — recap/nonevent posts produce no
-- event row, so events.source_ref alone could never remember them.
create table public.source_items (
  source_id uuid not null references public.sources(id) on delete cascade,
  item_url text not null,
  -- sha256 of the normalized caption/post text (IG/TG) or of the page content
  -- / JSON event fingerprint (websites). NULL = backfilled from
  -- events.source_ref (content unknown); the first sweep adopts the
  -- then-current hash without re-extracting.
  content_hash text,
  outcome text not null check (outcome in ('kept', 'recap', 'nonevent', 'dropped_invalid', 'error')),
  -- source_refs of the event rows this item produced. If any of them
  -- disappears (e.g. a repair deleted the row), the item re-extracts instead
  -- of staying suppressed. 'error' rows always re-extract.
  event_refs text[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (source_id, item_url)
);

-- Service-role only (same posture as ingest_errors): RLS on, no policies.
alter table public.source_items enable row level security;

-- Backfill kept items from events.source_ref so the very next sweep already
-- skips them. IG/telegram only: their item granularity is the post URL, which
-- IS the source_ref's URL part. Website items are keyed by the venue page URL,
-- which source_ref does not hold — they register on their first sweep.
insert into public.source_items (source_id, item_url, outcome, event_refs)
select s.id, split_part(e.source_ref, '#', 1), 'kept', array_agg(e.source_ref)
from public.events e
join public.sources s
  on s.venue_id = e.venue_id and s.kind::text = e.source_type::text and s.enabled
where e.source_ref is not null and e.source_type::text in ('instagram', 'telegram')
group by s.id, split_part(e.source_ref, '#', 1)
on conflict (source_id, item_url) do nothing;
