// Account deletion (delete-account) — backs the in-app "Delete account"
// action and the promise on https://ajmo.events/data-deletion.
//
// The caller's JWT is the only input: the user id is derived from the token,
// never from the body, so a user can only ever delete themselves. Every
// user-owned table (profiles, saves, event_reminders) references auth.users
// with ON DELETE CASCADE, so the admin delete of the auth user removes all of
// it in one shot; shared catalog rows (cities/venues/events/sources) hold no
// user references and are untouched.
//
// Idempotent: a repeat call for an already-deleted user returns ok.

import { createClient } from 'jsr:@supabase/supabase-js@2';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ ok: false, error: 'missing token' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    // A validly signed token whose user is already gone = a repeat call after
    // a successful delete — report success, not failure.
    if (error?.message?.toLowerCase().includes('does not exist')) {
      return json({ ok: true, already_deleted: true }, 200);
    }
    return json({ ok: false, error: 'invalid or expired token' }, 401);
  }

  const userId = data.user.id;
  const { error: delError } = await admin.auth.admin.deleteUser(userId);
  if (delError && delError.status !== 404) {
    console.error(
      JSON.stringify({ event: 'account_delete_failed', user_id: userId, message: delError.message }),
    );
    return json({ ok: false, error: 'deletion failed' }, 500);
  }

  // Audit trail: user id + timestamp only, no personal content.
  console.log(
    JSON.stringify({ event: 'account_deleted', user_id: userId, at: new Date().toISOString() }),
  );
  return json({ ok: true }, 200);
});
