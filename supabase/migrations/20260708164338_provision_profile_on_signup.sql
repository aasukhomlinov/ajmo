-- Auto-provision a profiles row for every new auth user.
--
-- The auth phase (magic link) requires a profiles row per user
-- (id = auth.users.id). A security-definer trigger on auth.users beats an
-- upsert-on-login from the client: it is atomic with signup, needs no client
-- round trip, and covers every future sign-in method (Apple/Google) unchanged.
-- search_path pinned per lint 0011; all names schema-qualified.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill any users that signed up before this trigger existed.
insert into public.profiles (id)
select u.id
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
