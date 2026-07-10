-- Security advisor (lints 0028/0029): public.handle_new_user() is SECURITY
-- DEFINER and was executable by anon/authenticated via the default PUBLIC
-- grant, exposing it at /rest/v1/rpc/handle_new_user. It only ever runs as
-- the on_auth_user_created trigger; Postgres checks EXECUTE on a trigger
-- function at trigger-creation time, not at fire time, so revoking here does
-- not affect signups.
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
