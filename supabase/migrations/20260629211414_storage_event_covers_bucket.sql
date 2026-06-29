-- Public Storage bucket for durable event cover images (rehosted off Telegram CDN).
--
-- Parsed events stored cover_url as cdn4.telesco.pe/file/<token>.jpg — Telegram
-- CDN links that aren't guaranteed permanent. The parser now downloads each
-- cover and re-hosts it here; events.covers holds the Supabase public URL.
insert into storage.buckets (id, name, public)
values ('event-covers', 'event-covers', true)
on conflict (id) do nothing;

-- Public read; writes go through the service role only (no insert/update/delete
-- policy → blocked for anon/authenticated, bypassed by the service role).
drop policy if exists "Event covers are publicly readable" on storage.objects;
create policy "Event covers are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'event-covers');
