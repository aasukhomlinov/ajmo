# Supabase security notes

## Leaked password protection (Auth)

Security advisor `auth_leaked_password_protection` flags that HaveIBeenPwned
checking is off. ajmo is **passwordless** (email OTP / magic-link only — see
CLAUDE.md → Auth), so users never set a password and this protection has no
effect on our flows. It is enabled anyway to clear the advisor (zero downside).

- Setting: Dashboard → Authentication → **Password** (Sign In / Providers) →
  "Prevent use of leaked passwords" (a.k.a. HIBP check).
- No SQL/migration exists for this — it's a GoTrue config toggle, not a DB
  object, and the Supabase MCP connector exposes no auth-config tool. It is set
  via the dashboard.
