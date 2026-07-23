-- Dedup reconciliation machinery (dedup-events edge function).
--
-- 1. events.cover_hash — 64-bit perceptual dHash (hex) of covers[1], computed
--    once per image by dedup-events; cover_hash_src records WHICH url was
--    hashed, so a re-hosted or replaced cover invalidates the hash for free.
-- 2. _repair_20260723_dedup — full pre-sweep snapshot of events (repair
--    pattern: reversible, back up first).
-- 3. _dedup_merges — one row per merged-away loser: full jsonb snapshot +
--    survivor id + deciding signal. Restore path:
--      insert into events select * from jsonb_populate_record(null::events, loser);
-- 4. merge_event_pair(survivor, loser, deciding) — the ONLY way a merge runs.
--    Transactional: backs up the loser, moves saves + event_reminders,
--    carries over fields the survivor lacks, deletes the loser, then keeps
--    the source_items ledger consistent — repoints the loser's source_ref to
--    the survivor's inside event_refs, or lets the survivor ADOPT the ref
--    when it has none. Without the repoint the ledger skip-check fails
--    ('kept' refs must exist in events), the next sweep re-extracts the
--    merged item, and the duplicate comes straight back.

alter table public.events
  add column if not exists cover_hash text,
  add column if not exists cover_hash_src text;
comment on column public.events.cover_hash is
  '64-bit dHash (hex) of covers[1]; perceptual dedup signal, computed by dedup-events';
comment on column public.events.cover_hash_src is
  'URL cover_hash was computed from; mismatch with covers[1] = stale hash, recompute';

create table public._repair_20260723_dedup as
  select now() as backed_up_at, e.* from public.events e;
alter table public._repair_20260723_dedup enable row level security;

create table public._dedup_merges (
  merged_at   timestamptz not null default now(),
  survivor_id uuid not null,
  deciding    text not null,
  loser       jsonb not null
);
alter table public._dedup_merges enable row level security;

create or replace function public.merge_event_pair(p_survivor uuid, p_loser uuid, p_deciding text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.events%rowtype;
  l public.events%rowtype;
  take_loser_cover boolean;
  v_saves int := 0;
  v_rem_moved int := 0;
  v_rem_deduped int := 0;
  v_ledger int := 0;
begin
  if p_survivor = p_loser then raise exception 'survivor = loser'; end if;
  select * into s from public.events where id = p_survivor for update;
  if not found then raise exception 'survivor % not found', p_survivor; end if;
  select * into l from public.events where id = p_loser for update;
  if not found then raise exception 'loser % not found', p_loser; end if;
  if s.venue_id <> l.venue_id then
    raise exception 'cross-venue merge refused (% vs %)', s.venue_id, l.venue_id;
  end if;

  insert into public._dedup_merges (survivor_id, deciding, loser)
  values (p_survivor, p_deciding, to_jsonb(l));

  -- user data first: saves move to the survivor (PK collisions collapse) …
  with moved as (
    insert into public.saves (user_id, event_id, created_at)
    select user_id, p_survivor, created_at from public.saves where event_id = p_loser
    on conflict (user_id, event_id) do nothing
    returning 1
  ) select count(*) into v_saves from moved;
  delete from public.saves where event_id = p_loser;

  -- … reminders too: exact (user, lead) duplicates die, the rest repoint.
  with deduped as (
    delete from public.event_reminders r
    where r.event_id = p_loser
      and exists (
        select 1 from public.event_reminders x
        where x.event_id = p_survivor and x.user_id = r.user_id
          and x.lead_minutes = r.lead_minutes)
    returning 1
  ) select count(*) into v_rem_deduped from deduped;
  with moved as (
    update public.event_reminders set event_id = p_survivor
    where event_id = p_loser returning 1
  ) select count(*) into v_rem_moved from moved;

  -- field carry-over: anything the loser has and the survivor lacks. Cover
  -- prefers storage: a re-hosted loser cover beats a raw CDN link that expires.
  take_loser_cover := l.covers is not null and (
    s.covers is null
    or (l.covers[1] like '%/storage/v1/object/public/%'
        and s.covers[1] not like '%/storage/v1/object/public/%'));

  update public.events e set
    description      = coalesce(e.description, l.description),
    title_i18n       = coalesce(e.title_i18n, l.title_i18n),
    description_i18n = coalesce(e.description_i18n, l.description_i18n),
    price_text       = coalesce(e.price_text, l.price_text),
    ends_at          = coalesce(e.ends_at, l.ends_at),
    film             = coalesce(e.film, l.film),
    is_free          = e.is_free or l.is_free,
    category         = case when e.category = 'other' and l.category <> 'other'
                            then l.category else e.category end,
    covers           = case when take_loser_cover then l.covers else e.covers end,
    cover_hash       = case when take_loser_cover then l.cover_hash else e.cover_hash end,
    cover_hash_src   = case when take_loser_cover then l.cover_hash_src else e.cover_hash_src end,
    updated_at       = now()
  where e.id = p_survivor;

  -- loser goes before ref bookkeeping so the unique source_ref frees up
  delete from public.events where id = p_loser;

  if l.source_ref is not null then
    if s.source_ref is null then
      -- survivor adopts the loser's ref: every ledger row stays valid as-is
      update public.events set source_ref = l.source_ref where id = p_survivor;
    else
      with u as (
        update public.source_items si
        set event_refs = (
          select array_agg(distinct case when r = l.source_ref then s.source_ref else r end)
          from unnest(si.event_refs) as r)
        where l.source_ref = any(si.event_refs)
        returning 1
      ) select count(*) into v_ledger from u;
    end if;
  end if;

  return jsonb_build_object(
    'saves_moved', v_saves,
    'reminders_moved', v_rem_moved,
    'reminders_deduped', v_rem_deduped,
    'ledger_rows_repointed', v_ledger,
    'ref_adopted', l.source_ref is not null and s.source_ref is null);
end $$;

revoke all on function public.merge_event_pair(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.merge_event_pair(uuid, uuid, text) to service_role;
