-- Seed Instagram sources for parse-venue (Apify instagram-post-scraper).
--
-- One `sources` row per venue below (authoritative list from the venue
-- spreadsheet). handle is verbatim (literal underscores/dots matter, e.g.
-- 24bar____ / dimsam___); url is derived from it. venue_id + city_id resolve
-- from `venues` by name at apply time (case/edge-space-insensitive) — no
-- hardcoded UUIDs. A venue not yet in `venues` is simply skipped (inner join,
-- no FK error) and named in the NOTICE this migration raises when applied.
--
-- Idempotent: `on conflict (handle) do nothing`; the temp scratch table is
-- session-local and dropped at the end, so re-runs are clean.

create temporary table _ig_seed (handle text not null, venue_name text not null);

insert into _ig_seed (handle, venue_name) values
  -- Belgrade
  ('kcgrad',                      'KC Grad'),
  ('zappabaza',                   'Zappa Baza'),
  ('zappabarka',                  'Zappa Barka'),
  ('newtekstilbelgrade',          'Novi Tekstil'),
  ('spratbar',                    'Sprat'),
  ('20_44.nightclub',             '20/44'),
  ('kontra_punk_t',               'Kontrapunkt'),
  ('dorcolplatz',                 'Dorćol Platz'),
  ('bluzipivobar',                'Bluz i Pivo'),
  ('modula.belgrade',             'Modula'),
  ('dimsam___',                   'Dim'),
  ('guvernantabar',               'Guvernanta'),
  ('vukosava_najbolja_drugarica_','Vukosava'),
  ('ukparobrod',                  'UK Parobrod'),
  ('geum.bistro',                 'Geum'),
  ('kvaka22_catch22',             'Kvaka 22'),
  ('silosibeograd',               'Silosi'),
  ('museumofafricanartbelgrade',  'Muzej Afričke Umetnosti'),
  ('sense_s.space',               'Sense—S'),
  ('ulicna_galerija',             'Ulična Galerija'),
  ('skart.bgd',                   'Škart'),
  ('novi_bioskop_zvezda',         'Novi Bioskop Zvezda'),
  -- Novi Sad
  ('pozoristepromena',            'Pozorište Promena'),
  ('kc_lab021',                   'KC Lab'),
  ('skc.ns',                      'SKCNS'),
  ('prostorprostor',              'Prostor'),
  ('graffiti_neusatz',            'Graffiti Bar'),
  ('acnovisad',                   'Američki kutak'),
  ('shootiranje_ns',              'Shootiranje'),
  ('belart_gallery',              'Galerija BelArt'),
  ('tsoycenter',                  'Coj centar'),
  ('skup.udruzenje',              'SKUP'),
  ('rebelpub.ns',                 'Rebel Pub'),
  ('board.cats',                  'Boardcats'),
  ('barakudans',                  'BARAKUDA Bar & Yachting'),
  ('arenapub_ns',                 'Arena Pub'),
  ('beergarden_strand',           'Beer Garden'),
  ('24bar____',                   '24bar'),
  ('salonuradnickoj',             'Salon u Radničkoj'),
  ('bulevarbooks',                'bulevar books'),
  ('barimperija',                 'Bar Imperija'),
  ('splavcristal',                'Splav Cristal'),
  ('zenit.books',                 'Zenit Books'),
  ('srukoj',                      'Sobaka s rukoj'),
  ('raynovisad',                  'Ray Bar'),
  ('puberaj',                     'PUBeraj'),
  ('nomadthebar',                 'Nomad Cocktail Bar'),
  ('spajz.novisad',               'Špajz'),
  ('ordinacija_art_cafe',         'Ordinacija Art Cafe'),
  ('edjseg_ks',                   'Kulturna stanica Eđšeg'),
  ('jazzclub_novosadasnji',       'S.O.M.'),
  ('cafe_knjizara_nublu',         'Cafe Knjižara Nublu'),
  ('londonpub.ns',                'London Pub'),
  ('caffeluster',                 'Caffe Luster');

insert into public.sources (kind, handle, url, venue_id, city_id, enabled)
select 'instagram', s.handle,
       'https://www.instagram.com/' || s.handle || '/',
       v.id, v.city_id, true
from _ig_seed s
join public.venues v on lower(btrim(v.name)) = lower(btrim(s.venue_name))
on conflict (handle) do nothing;

-- Report venues with no matching `venues` row (skipped — add them, then re-run).
do $$
declare
  skipped text;
begin
  select string_agg(s.venue_name, E'\n  · ' order by s.venue_name)
    into skipped
  from _ig_seed s
  where not exists (
    select 1 from public.venues v
    where lower(btrim(v.name)) = lower(btrim(s.venue_name))
  );
  if skipped is not null then
    raise notice E'[instagram seed] no venues row (skipped):\n  · %', skipped;
  else
    raise notice '[instagram seed] all % candidate venues matched',
      (select count(*) from _ig_seed);
  end if;
end $$;

drop table _ig_seed;
