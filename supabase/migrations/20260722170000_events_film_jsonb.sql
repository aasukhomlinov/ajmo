-- Film metadata for cinema events, resolved via TMDb by parse-venue's `film`
-- phase. Shape: {"query":{title,year,country}} = extracted, lookup pending;
-- adding "resolved":true (+tmdb_id+titles) or "resolved":false = done, never
-- retried. No separate table — one film per event, read only by the parser.

alter table public.events add column if not exists film jsonb;
