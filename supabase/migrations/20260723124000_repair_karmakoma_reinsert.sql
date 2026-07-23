-- Follow-up to 20260723121000_repair_dupes_backfill_source_ref: during
-- verification the Karmakoma repost pair re-inserted because its two posts
-- now parse the start 1h apart and the fuzzy dedup matched same-instant only
-- (fixed to a ±6h window in parse-venue v28). Remove the re-inserted twin;
-- keep e85dba26 ("Club Drugstore takes over Karmakoma", post Da2fzwdMhPK).
insert into public._repair_20260723
  select now(), e.* from public.events e
  where e.source_ref = 'https://www.instagram.com/p/DbFtcXBMvkc/';
delete from public.events
  where source_ref = 'https://www.instagram.com/p/DbFtcXBMvkc/';
