-- Pin a fixed search_path on the updated_at trigger function.
--
-- Supabase's security linter flags functions with a mutable search_path
-- (lint 0011): a role could prepend a schema and shadow an unqualified name.
-- The function only calls now() (pg_catalog, always resolvable), so an empty
-- search_path is safe. Folded into init_schema for fresh setups; this migration
-- brings already-provisioned databases in line.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
