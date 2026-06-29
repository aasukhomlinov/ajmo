-- Multilingual event content (Phase 5, session 2).
--
-- DC Loża posts come in RU + EN (+ sometimes SR); aggregator events arrive in
-- whatever language the source used. Hold all three language versions of the
-- title and description as jsonb {en, ru, sr}. Per-language values are nullable
-- (a source may only have one language) — the app falls back to any available
-- language for the user's chosen one.
--
-- The scalar `title` / `description` columns STAY: `title` remains the canonical
-- value behind the dedup index (venue_id, starts_at, lower(title)) and a
-- guaranteed-present fallback; the jsonb columns are the presentation overlay.
alter table public.events
  add column title_i18n       jsonb,
  add column description_i18n jsonb;

comment on column public.events.title_i18n is
  'Localized titles {en,ru,sr}; nullable per language. The scalar `title` stays the canonical/dedup value and fallback.';
comment on column public.events.description_i18n is
  'Localized descriptions {en,ru,sr}; nullable per language. The scalar `description` is the fallback.';

-- Backfill the existing seed events into the language they already hold (their
-- copy is English). They are intentionally NOT translated — placeholders.
update public.events
set title_i18n = jsonb_build_object('en', title)
where title_i18n is null;

update public.events
set description_i18n = jsonb_build_object('en', description)
where description is not null and description_i18n is null;
