-- Venue catalog for the Instagram rollout: drop 5 obsolete venues, seed 52 new
-- ones (20 Belgrade, 32 Novi Sad). Unblocks 20260722150000_seed_instagram_sources,
-- which sorts after this and matches all venues via its insert-selects.
--
-- Delete safety: events.venue_id is ON DELETE RESTRICT, so if any events still
-- reference these venues the delete FAILS LOUDLY (wanted — never force).
-- Verified at authoring time: all 5 have 0 sources and 0 events (seed events
-- were removed by 20260720113115). sources.venue_id is SET NULL and
-- refresh_queue cascades, so no other FK can break.
--
-- Idempotent: delete is a no-op when already gone; inserts use
-- ON CONFLICT (city_id, slug) — the table's actual unique constraint
-- (slug alone is NOT unique; it's scoped per city).

delete from public.venues
where slug in ('cetinjska-15', 'beton-hala', 'bioskop-balkan', 'elektropionir', 'quarter');

insert into public.venues (city_id, name, slug, address)
select c.id, v.name, v.slug, v.address
from (values
  -- Belgrade
  ('belgrade', 'Zappa Baza',              'zappa-baza',              'Bulevar Vojvode Bojovića 30a'),
  ('belgrade', 'Zappa Barka',             'zappa-barka',             'Kej kod Kule Nebojša'),
  ('belgrade', 'Novi Tekstil',            'novi-tekstil',            'Dunavska 86'),
  ('belgrade', 'Sprat',                   'sprat',                   'Cetinjska 15'),
  ('belgrade', '20/44',                   '20-44',                   'Karađorđeva 44'),
  ('belgrade', 'Kontrapunkt',             'kontrapunkt',             'Despota Stefana 68b'),
  ('belgrade', 'Bluz i Pivo',             'bluz-i-pivo',             'Cetinjska 15'),
  ('belgrade', 'Modula',                  'modula',                  'Cetinjska 15'),
  ('belgrade', 'Dim',                     'dim',                     'Cetinjska 15a'),
  ('belgrade', 'Guvernanta',              'guvernanta',              'Balkanska 4'),
  ('belgrade', 'Vukosava',                'vukosava',                'Karađorđeva 44'),
  ('belgrade', 'UK Parobrod',             'uk-parobrod',             'Kapetan Mišina 6a'),
  ('belgrade', 'Geum',                    'geum',                    'Takovska 45a'),
  ('belgrade', 'Kvaka 22',                'kvaka-22',                'Ruzveltova 39'),
  ('belgrade', 'Silosi',                  'silosi',                  'Dunavski kej 46'),
  ('belgrade', 'Muzej Afričke Umetnosti', 'muzej-africke-umetnosti', 'Andre Nikolića 14'),
  ('belgrade', 'Sense—S',                 'sense-s',                 'Dečanska 8'),
  ('belgrade', 'Ulična Galerija',         'ulicna-galerija',         'Čavketov pasaž'),
  ('belgrade', 'Škart',                   'skart',                   'Kneginje Ljubice 26'),
  ('belgrade', 'Novi Bioskop Zvezda',     'novi-bioskop-zvezda',     'Terazije 40'),
  -- Novi Sad
  ('novi-sad', 'Pozorište Promena',       'pozoriste-promena',       'Đure Jakšića 7'),
  ('novi-sad', 'KC Lab',                  'kc-lab',                  'Dr Hempta 2'),
  ('novi-sad', 'SKCNS',                   'skcns',                   'Vladimira Perića Valtera 5'),
  ('novi-sad', 'Prostor',                 'prostor',                 'Beogradska 11 Petrovaradin'),
  ('novi-sad', 'Graffiti Bar',            'graffiti-bar',            'Kosovska 21a'),
  ('novi-sad', 'Američki kutak',          'americki-kutak',          'Kej Žrtava Racije 2'),
  ('novi-sad', 'Shootiranje',             'shootiranje',             'Ilije Ognjanovića 9'),
  ('novi-sad', 'Galerija BelArt',         'galerija-belart',         'Bulevar Mihajla Pupina 17'),
  ('novi-sad', 'Coj centar',              'coj-centar',              'Jevrejska 38'),
  ('novi-sad', 'SKUP',                    'skup',                    'Despota Stefana 5'),
  ('novi-sad', 'Rebel Pub',               'rebel-pub',               'Trg Slobode 2'),
  ('novi-sad', 'Boardcats',               'boardcats',               'Petra Drapšina 9'),
  ('novi-sad', 'BARAKUDA Bar & Yachting', 'barakuda-bar-yachting',   'Ribarsko Ostrvo 23'),
  ('novi-sad', 'Arena Pub',               'arena-pub',               'Železnička 9'),
  ('novi-sad', 'Beer Garden',             'beer-garden',             'Štrand Plaža'),
  ('novi-sad', '24bar',                   '24bar',                   'Trg Republike 24'),
  ('novi-sad', 'Salon u Radničkoj',       'salon-u-radnickoj',       'Radnička 27'),
  ('novi-sad', 'bulevar books',           'bulevar-books',           'Bulevar Mihajla Pupina 6'),
  ('novi-sad', 'Bar Imperija',            'bar-imperija',            'Zmaj Jovina 10, Pasaž'),
  ('novi-sad', 'Splav Cristal',           'splav-cristal',           'Ribarsko Ostrvo'),
  ('novi-sad', 'Zenit Books',             'zenit-books',             'Njegoševa 24'),
  ('novi-sad', 'Sobaka s rukoj',          'sobaka-s-rukoj',          'Katolička porta 2'),
  ('novi-sad', 'Ray Bar',                 'ray-bar',                 'Laze Telečkog 10'),
  ('novi-sad', 'PUBeraj',                 'puberaj',                 'Laze Telečkog 12'),
  ('novi-sad', 'Nomad Cocktail Bar',      'nomad-cocktail-bar',      'Dunavska 14'),
  ('novi-sad', 'Špajz',                   'spajz',                   'Trifkovićev Trg 2'),
  ('novi-sad', 'Ordinacija Art Cafe',     'ordinacija-art-cafe',     'Jevrejska 4'),
  ('novi-sad', 'Kulturna stanica Eđšeg',  'kulturna-stanica-edjseg', 'Antona Čehova 4'),
  ('novi-sad', 'S.O.M.',                  's-o-m',                   'Zmaj Jovina 20'),
  ('novi-sad', 'Cafe Knjižara Nublu',     'cafe-knjizara-nublu',     'Žarka Zrenjanina 12'),
  ('novi-sad', 'London Pub',              'london-pub',              'Laze Telečkog 15'),
  ('novi-sad', 'Caffe Luster',            'caffe-luster',            'Radnička 10')
) as v(city_slug, name, slug, address)
join public.cities c on c.slug = v.city_slug
on conflict (city_id, slug) do nothing;
