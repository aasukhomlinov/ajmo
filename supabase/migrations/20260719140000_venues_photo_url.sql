-- Venue fallback photo for event cards (parse-venue v2).
--
-- Events without a resolvable cover (no post image, no og:image on the detail
-- page) render the venue's own photo instead. Nullable — populated manually
-- per venue (design-owned asset, not parsed).
alter table public.venues add column photo_url text;
