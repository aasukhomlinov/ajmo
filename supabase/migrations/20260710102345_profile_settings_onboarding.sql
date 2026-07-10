-- Auth-2: the profile becomes the source of truth for the user's app settings.
-- Adds the notification/reminder PREFERENCES (no scheduling — that's a later
-- phase) and a per-user onboarding marker (replaces the device-local flag so
-- account switching and reinstalls resolve onboarding from the profile).

alter table public.profiles
  add column if not exists push_enabled boolean not null default true,
  add column if not exists reminders_enabled boolean not null default true,
  add column if not exists reminder_offsets text[] not null default array['1_day'],
  add column if not exists onboarded_at timestamptz;

alter table public.profiles
  add constraint profiles_reminder_offsets_valid
  check (reminder_offsets <@ array['1_week', '2_days', '1_day', 'day_of']);

comment on column public.profiles.push_enabled is 'Master push switch (Profile hub). Preference only in MVP.';
comment on column public.profiles.reminders_enabled is 'Master event-reminders switch. Preference only in MVP.';
comment on column public.profiles.reminder_offsets is 'Default reminder lead-times, multi-select: 1_week | 2_days | 1_day | day_of.';
comment on column public.profiles.onboarded_at is 'When the post-first-sign-in onboarding (city -> notifications) finished. NULL = show onboarding.';
