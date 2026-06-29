-- Ajmo Phase 5 — catalog seed.
--
-- Seeds the two launch cities, the real venues behind the Discover fixture
-- (plus DC Loža, the first Telegram source for the upcoming parser), and the
-- same ~20 events the app previously read from src/lib/mocks/events.ts — so the
-- feed/search/saved screens keep the same content after switching to Supabase.
--
-- Idempotent: cities key on slug, venues on (city_id, slug), events on
-- source_ref ('seed:<id>'), all ON CONFLICT DO NOTHING.
--
-- Event start times are computed RELATIVE to the moment this migration runs
-- (date_trunc('day', now()) + offset), mirroring the fixture's relative `at()`
-- helper so the feed shows an upcoming week of events right after the switch.

-- ── cities ───────────────────────────────────────────────────────────────────
insert into public.cities (name, country_code, slug, enabled) values
  ('Belgrade', 'RS', 'belgrade', true),
  ('Novi Sad', 'RS', 'novi-sad', true)
on conflict (slug) do nothing;

-- ── venues ───────────────────────────────────────────────────────────────────
-- lat/lng are approximate real coordinates (enough for the Event Detail map pin).
-- DC Loža is not yet tied to any seeded event — it primes the t.me/dcloza parser.
insert into public.venues (city_id, name, slug, address, lat, lng, telegram)
select c.id, v.name, v.slug, v.address, v.lat, v.lng, v.telegram
from (values
  ('belgrade', 'Dom omladine Beograda',       'dom-omladine-beograda',      'Makedonska 22',              44.8127, 20.4631, null),
  ('belgrade', 'Drugstore',                    'drugstore',                  'Bulevar despota Stefana 115', 44.8196, 20.4823, null),
  ('belgrade', 'KC Grad',                      'kc-grad',                    'Braće Krsmanović 4',         44.8166, 20.4558, null),
  ('belgrade', 'Dorćol Platz',                 'dorcol-platz',               'Dobračina 59b',              44.8232, 20.4651, null),
  ('belgrade', 'Bioskop Balkan',               'bioskop-balkan',             'Braće Jugovića 16',          44.8169, 20.4592, null),
  ('belgrade', 'Madlenianum',                  'madlenianum',                'Glavna 32, Zemun',           44.8432, 20.4109, null),
  ('belgrade', 'Bitefartcafe',                 'bitefartcafe',               'Skver Mire Trailović 1',     44.8155, 20.4717, null),
  ('belgrade', 'Cetinjska 15',                 'cetinjska-15',               'Cetinjska 15',               44.8170, 20.4625, null),
  ('belgrade', 'Magacin',                      'magacin',                    'Kraljevića Marka 4',         44.8143, 20.4554, null),
  ('belgrade', 'Muzej savremene umetnosti',    'muzej-savremene-umetnosti',  'Ušće 10',                    44.8193, 20.4435, null),
  ('belgrade', 'Kombank Dvorana',              'kombank-dvorana',            'Trg Nikole Pašića 5',        44.8122, 20.4642, null),
  ('belgrade', 'Elektropionir',                'elektropionir',              'Vlajkovićeva 9',             44.8116, 20.4668, null),
  ('belgrade', 'Beton hala',                   'beton-hala',                 'Karađorđeva 2–4',            44.8174, 20.4521, null),
  ('belgrade', 'Kolarac',                      'kolarac',                    'Studentski trg 5',           44.8185, 20.4566, null),
  ('belgrade', 'DC Loža',                      'dc-loza',                    'Dalmatinska 84L, Beograd',   44.8089, 20.4807, 'https://t.me/dcloza'),
  ('novi-sad', 'Quarter',                      'quarter',                    'Beogradski kej 9',           45.2516, 19.8567, null),
  ('novi-sad', 'Kulturni centar Novog Sada',   'kulturni-centar-novog-sada', 'Katolička porta 5',          45.2551, 19.8455, null),
  ('novi-sad', 'Srpsko narodno pozorište',     'srpsko-narodno-pozoriste',   'Pozorišni trg 1',            45.2557, 19.8469, null),
  ('novi-sad', 'Fabrika',                      'fabrika',                    'Bulevar despota Stefana 5',  45.2642, 19.8331, null)
) as v(city_slug, name, slug, address, lat, lng, telegram)
join public.cities c on c.slug = v.city_slug
on conflict (city_id, slug) do nothing;

-- ── events ───────────────────────────────────────────────────────────────────
-- Each row: venue slug, content, a day offset + start (h,m), an optional end
-- (h,m → null when the source only published a start), price, free flag and the
-- cover gallery (covers[0] is the feed thumbnail).
insert into public.events (
  city_id, venue_id, title, description, category,
  starts_at, ends_at, price_text, is_free, covers,
  source_type, source_url, source_ref, status
)
select
  ven.city_id,
  ven.id,
  e.title,
  e.description,
  e.category::public.event_category,
  date_trunc('day', now()) + make_interval(days => e.day_off, hours => e.sh, mins => e.sm),
  case when e.eh is null then null
       else date_trunc('day', now()) + make_interval(days => e.day_off, hours => e.eh, mins => e.em)
  end,
  e.price_text,
  e.is_free,
  e.covers,
  'website'::public.event_source_type,
  e.source_url,
  e.source_ref,
  'published'::public.event_status
from (values
  ('dom-omladine-beograda', 'Noize MC',
    'Russian rap-rock provocateur live, with a full band and a late support set.',
    'music', 0, 21, 0, null::int, null::int, '2500 RSD', false,
    array['https://picsum.photos/seed/ajmo-noize-mc/800/600','https://picsum.photos/seed/ajmo-noize-mc-2/800/600','https://picsum.photos/seed/ajmo-noize-mc-3/800/600'],
    'https://www.domomladine.org/events/noize-mc', 'seed:bg-noize-mc'),

  ('drugstore', 'Drumcode Night: Adam Beyer',
    'Techno marathon in the old slaughterhouse hall — doors at 23:00, no re-entry.',
    'party', 0, 23, 30, null, null, '3500 RSD', false,
    array['https://picsum.photos/seed/ajmo-drumcode/800/600','https://picsum.photos/seed/ajmo-drumcode-2/800/600','https://picsum.photos/seed/ajmo-drumcode-3/800/600'],
    'https://www.drugstore.rs/events/adam-beyer', 'seed:bg-drumcode'),

  ('kc-grad', 'Marina Abramović: Retrospektiva',
    'Archival performance documentation and new video work, free entry all evening.',
    'art', 0, 18, 0, 22, 0, 'Free', true,
    array['https://picsum.photos/seed/ajmo-abramovic/800/600','https://picsum.photos/seed/ajmo-abramovic-2/800/600','https://picsum.photos/seed/ajmo-abramovic-3/800/600','https://picsum.photos/seed/ajmo-abramovic-4/800/600'],
    'https://www.kcgrad.rs/events/abramovic', 'seed:bg-abramovic'),

  ('dorcol-platz', 'Dorćol Street Food Market',
    'Two dozen kitchens, natural wine bar and a vinyl corner in the courtyard.',
    'food', 1, 12, 0, 20, 0, 'Free', true,
    array['https://picsum.photos/seed/ajmo-street-food/800/600'],
    'https://www.dorcolplatz.com/events/street-food', 'seed:bg-street-food'),

  ('bioskop-balkan', 'Letnji bioskop: Apocalypse Now',
    'The Final Cut on 35mm, introduced by the cinematheque programmer.',
    'cinema', 1, 21, 30, null, null, '600 RSD', false,
    array['https://picsum.photos/seed/ajmo-apocalypse/800/600'],
    'https://www.bioskopbalkan.rs/letnji/apocalypse-now', 'seed:bg-letnji-bioskop'),

  ('madlenianum', 'Bure baruta',
    'Dejan Dukovski’s Balkan classic, staged in a single unbroken night.',
    'theatre', 2, 19, 30, null, null, '1800 RSD', false,
    array['https://picsum.photos/seed/ajmo-bure-baruta/800/600'],
    'https://www.madlenianum.rs/repertoar/bure-baruta', 'seed:bg-bure-baruta'),

  ('bitefartcafe', 'Jazz veče: Bilja Krstić & Bistrik',
    'Balkan folk reworked for a jazz quintet — two sets, table seating.',
    'music', 2, 20, 0, 23, 0, '1500 RSD', false,
    array['https://picsum.photos/seed/ajmo-bistrik/800/600'],
    'https://www.bitef.rs/bitefartcafe/bistrik', 'seed:bg-jazz-bistrik'),

  ('cetinjska-15', 'Cetinjska Open Air',
    'Free yard party rotating through every bar in the old brewery block.',
    'party', 3, 22, 0, null, null, 'Free', true,
    array['https://picsum.photos/seed/ajmo-cetinjska/800/600'],
    'https://www.facebook.com/cetinjska15/openair', 'seed:bg-cetinjska-openair'),

  ('magacin', 'Dizajn Market',
    'Independent designers, ceramics and print — small-batch only.',
    'market', 3, 11, 0, 18, 0, 'Free', true,
    array['https://picsum.photos/seed/ajmo-dizajn-market/800/600'],
    'https://www.magacin.org/dizajn-market', 'seed:bg-dizajn-market'),

  ('muzej-savremene-umetnosti', 'Noć muzeja: Specijalna tura',
    'After-hours guided tour of the permanent collection plus a rooftop set.',
    'art', 4, 17, 0, 23, 0, '800 RSD', false,
    array['https://picsum.photos/seed/ajmo-noc-muzeja/800/600'],
    'https://www.msub.org.rs/noc-muzeja', 'seed:bg-noc-muzeja'),

  ('kombank-dvorana', 'FEST premijera + Q&A',
    'Opening-night domestic feature with the director and cast in the room.',
    'cinema', 4, 20, 0, null, null, '700 RSD', false,
    array['https://picsum.photos/seed/ajmo-fest/800/600'],
    'https://www.fest.rs/premijera', 'seed:bg-fest-premijera'),

  ('elektropionir', 'Indie veče: Repetitor',
    'Belgrade post-punk trio, loud and early — support act opens at 21:00.',
    'music', 5, 21, 0, null, null, '1200 RSD', false,
    array['https://picsum.photos/seed/ajmo-repetitor/800/600'],
    'https://www.elektropionir.rs/repetitor', 'seed:bg-repetitor'),

  ('drugstore', 'Techno Podzemlje',
    'Local residents take the basement until close. Cash only at the bar.',
    'party', 5, 23, 0, null, null, '2000 RSD', false,
    array['https://picsum.photos/seed/ajmo-podzemlje/800/600'],
    'https://www.drugstore.rs/events/podzemlje', 'seed:bg-techno-podzemlje'),

  ('bitefartcafe', 'Gospođa ministarka',
    'Nušić’s satire in a stripped-back studio staging. Serbian, no surtitles.',
    'theatre', 6, 19, 0, null, null, '1600 RSD', false,
    array['https://picsum.photos/seed/ajmo-ministarka/800/600'],
    'https://www.bitef.rs/ministarka', 'seed:bg-gospodja-ministarka'),

  ('beton-hala', 'Beograd Wine Festival',
    'Riverfront tasting with 40+ regional winemakers; glass included with entry.',
    'food', 6, 17, 0, 22, 0, '1000 RSD', false,
    array['https://picsum.photos/seed/ajmo-wine/800/600'],
    'https://www.beogradwinefestival.rs', 'seed:bg-vinski-festival'),

  ('kolarac', 'Beogradska filharmonija: Mahler 5',
    'Mahler’s Fifth under the principal guest conductor. Doors 19:30.',
    'music', 7, 20, 0, null, null, '2200 RSD', false,
    array['https://picsum.photos/seed/ajmo-filharmonija/800/600'],
    'https://www.bgf.rs/koncerti/mahler-5', 'seed:bg-filharmonija'),

  ('quarter', 'Egzit Warm-up: Boris Brejcha',
    'High-tech minimal night in the Petrovaradin district ahead of the festival.',
    'party', 1, 22, 0, null, null, '3000 RSD', false,
    array['https://picsum.photos/seed/ajmo-brejcha/800/600','https://picsum.photos/seed/ajmo-brejcha-2/800/600'],
    'https://www.exitfest.org/warmup/brejcha', 'seed:ns-boris-brejcha'),

  ('kulturni-centar-novog-sada', 'Izložba: Sterijino pozorje',
    'Seventy years of the theatre festival in posters, sets and photographs.',
    'art', 2, 18, 0, 21, 0, 'Free', true,
    array['https://picsum.photos/seed/ajmo-sterijino/800/600'],
    'https://www.kcns.org.rs/sterijino', 'seed:ns-sterijino-pozorje'),

  ('srpsko-narodno-pozoriste', 'SNP: Koštana',
    'Bora Stanković’s drama with live tamburica accompaniment.',
    'theatre', 4, 19, 0, null, null, '1400 RSD', false,
    array['https://picsum.photos/seed/ajmo-kostana/800/600'],
    'https://www.snp.org.rs/repertoar/kostana', 'seed:ns-kostana'),

  ('fabrika', 'Salaš Doručak Market',
    'Slow-food brunch market — farm cheese, kajmak and rakija from the salaši.',
    'food', 5, 10, 0, 15, 0, 'Free', true,
    array['https://picsum.photos/seed/ajmo-salas/800/600'],
    'https://www.skcns.org.rs/fabrika/salas-market', 'seed:ns-salas-doruchak')
) as e(
  venue_slug, title, description, category,
  day_off, sh, sm, eh, em, price_text, is_free, covers,
  source_url, source_ref
)
join public.venues ven on ven.slug = e.venue_slug
on conflict (source_ref) do nothing;
