-- Ajmo Phase 5 — Row Level Security.
--
-- Public catalog (cities/venues/events): anon + authenticated may SELECT only
-- the visible rows. There are NO insert/update/delete policies for those tables,
-- so every write is blocked for client roles and must go through the service
-- role (parsers / Edge Functions), which bypasses RLS.
--
-- User data (profiles/saves/event_reminders): each authenticated user may read
-- and write ONLY their own rows. (Auth is wired in a later phase; the policies
-- sit ready.)

-- ── Public catalog ────────────────────────────────────────────────────────
alter table public.cities enable row level security;
alter table public.venues enable row level security;
alter table public.events enable row level security;

create policy "Enabled cities are viewable by everyone"
  on public.cities for select
  to anon, authenticated
  using (enabled = true);

create policy "Venues are viewable by everyone"
  on public.venues for select
  to anon, authenticated
  using (true);

create policy "Published events are viewable by everyone"
  on public.events for select
  to anon, authenticated
  using (status = 'published');

-- ── User-scoped tables ──────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.saves enable row level security;
alter table public.event_reminders enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read their own saves"
  on public.saves for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can add their own saves"
  on public.saves for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can remove their own saves"
  on public.saves for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can read their own reminders"
  on public.event_reminders for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can add their own reminders"
  on public.event_reminders for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own reminders"
  on public.event_reminders for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can remove their own reminders"
  on public.event_reminders for delete
  to authenticated
  using (auth.uid() = user_id);
