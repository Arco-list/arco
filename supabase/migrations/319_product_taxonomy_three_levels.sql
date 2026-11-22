-- 319: productindeling in drie niveaus — groep › subgroep › soort.
--
-- De navigatie toont twee niveaus (groep › subgroep); merken hangen aan een
-- subgroep, collecties waar het kan aan een of meer soorten. Het derde niveau
-- ligt er nu al, zodat er geen laag bij hoeft wanneer losse producten komen.
-- Opzet volgt Archiproducts, ingeperkt tot wat in high-end woonprojecten
-- voorkomt (geen kantoor, contract of bouwmateriaal).
--
-- Bestaande rijen blijven bestaan waar het begrip blijft (hun koppelingen met
-- merken en collecties gaan mee); ze krijgen soms een nieuwe naam, slug of
-- ouder. Niets wordt verwijderd, op dubbele soortkoppelingen na (deel B,
-- onderaan, handmatig uit te voeren).

begin;

-- ── 1. Bestaande rijen: hernoemen en verhangen ─────────────────────────────
-- Volgorde telt bij de slugs: 'beds' komt pas vrij nadat de groep 'bedroom'
-- heet.

update product_categories set name = 'Decor & textiles', name_nl = 'Decor & textiel' where slug = 'decor';
update product_categories set name = 'Building & systems', name_nl = 'Bouw & techniek' where slug = 'construction';

-- Meubels
update product_categories set slug = 'sofas-armchairs', name = 'Sofas & armchairs', name_nl = 'Banken & fauteuils', order_index = 1 where slug = 'seating';
update product_categories set slug = 'tables-chairs', name = 'Tables & chairs', name_nl = 'Tafels & stoelen', order_index = 2 where slug = 'tables';
update product_categories set name = 'Storage', name_nl = 'Kasten', order_index = 3 where slug = 'storage';
update product_categories set slug = 'bedroom', name = 'Bedroom', name_nl = 'Slaapkamer', order_index = 4 where slug = 'beds';
update product_categories set slug = 'beds', name = 'Beds', name_nl = 'Bedden' where slug = 'bed-frame';
update product_categories set slug = 'wall-units', name = 'Wall units', name_nl = 'Wandsystemen' where slug = 'cabinet';

-- Keuken
update product_categories set name = 'Worktops', name_nl = 'Werkbladen', order_index = 2 where slug = 'countertops';
update product_categories set name = 'Appliances', name_nl = 'Apparatuur', order_index = 4 where slug = 'kitchen-appliances';
update product_categories set slug = 'hobs', name = 'Hobs', name_nl = 'Kookplaten' where slug = 'cooktops-ovens';

-- Badkamer
update product_categories set name = 'Sanitaryware', name_nl = 'Sanitair', order_index = 1 where slug = 'bathroom-fixtures';
update product_categories set name = 'Showers', name_nl = 'Douches', order_index = 2 where slug = 'showers';
update product_categories set name = 'Taps', name_nl = 'Kranen', order_index = 3 where slug = 'bathroom-fittings';
update product_categories set name = 'Bathroom furniture', name_nl = 'Badmeubels', order_index = 4 where slug = 'vanities';
update product_categories set name = 'Accessories', name_nl = 'Accessoires', order_index = 5 where slug = 'bathroom-accessories';

-- Wellness
update product_categories set slug = 'sauna-steam', name = 'Sauna & steam', name_nl = 'Sauna & stoom', order_index = 1 where slug = 'spas-saunas';
update product_categories set name = 'Pools', name_nl = 'Zwembaden', order_index = 3,
  parent_id = (select id from product_categories where slug = 'wellness') where slug = 'pools';

-- Buiten
update product_categories set name = 'Outdoor furniture', name_nl = 'Tuinmeubels', order_index = 1 where slug = 'outdoor-furniture';
update product_categories set slug = 'outdoor-tables', name = 'Garden tables', name_nl = 'Tuintafels' where slug = 'outdoor-dining';

-- Verlichting
update product_categories set name = 'Outdoor lighting', name_nl = 'Buitenverlichting', order_index = 2 where slug = 'outdoor-lighting';

-- Afwerking
update product_categories set name = 'Doors', name_nl = 'Deuren', order_index = 3 where slug = 'doors';
update product_categories set name = 'Fireplaces', name_nl = 'Haarden', order_index = 5 where slug = 'indoor-fireplaces';
update product_categories set name = 'Radiators', name_nl = 'Radiatoren', order_index = 6 where slug = 'radiators';
update product_categories set name = 'Hardware & switches', name_nl = 'Beslag & schakelaars', order_index = 7 where slug = 'hardware';

-- ── 2. Nieuwe subgroepen (niveau 2) ────────────────────────────────────────

insert into product_categories (slug, name, name_nl, parent_id, order_index)
select v.slug, v.name, v.name_nl, p.id, v.ord
from (values
  ('workspace',           'Workspace',            'Werkplek',               'furniture',    5),
  ('indoor-lighting',     'Indoor lighting',      'Binnenverlichting',      'lighting',     1),
  ('kitchens',            'Kitchens',             'Keukens',                'kitchen',      1),
  ('sinks-taps',          'Sinks & taps',         'Spoelbakken & kranen',   'kitchen',      3),
  ('kitchen-accessories', 'Kitchen accessories',  'Keukenaccessoires',      'kitchen',      5),
  ('tableware-cookware',  'Table & cooking',      'Tafel & koken',          'kitchen',      6),
  ('spas',                'Spas',                 'Spa''s',                 'wellness',     2),
  ('outdoor-cooking',     'Outdoor cooking',      'Buitenkoken',            'outdoor',      2),
  ('fire-heat',           'Fire & heat',          'Vuur & warmte',          'outdoor',      3),
  ('shade',               'Shade & shelter',      'Schaduw & overkapping',  'outdoor',      4),
  ('garden-accessories',  'Garden accessories',   'Tuinaccessoires',        'outdoor',      5),
  ('home-accessories',    'Home accessories',     'Woonaccessoires',        'decor',        1),
  ('textiles',            'Textiles',             'Textiel',                'decor',        2),
  ('window-treatments',   'Window treatments',    'Raamdecoratie',          'decor',        3),
  ('art',                 'Art',                  'Kunst',                  'decor',        4),
  ('floors',              'Floors',               'Vloeren',                'finishes',     1),
  ('walls',               'Walls',                'Wanden',                 'finishes',     2),
  ('stairs',              'Stairs',               'Trappen',                'finishes',     4),
  ('windows-glazing',     'Windows & glazing',    'Ramen & puien',          'construction', 1),
  ('facade-roof',         'Facade & roof',        'Gevel & dak',            'construction', 2),
  ('installations',       'Installations',        'Installaties',           'construction', 3)
) as v(slug, name, name_nl, parent, ord)
join product_categories p on p.slug = v.parent
on conflict (slug) do update set name = excluded.name, name_nl = excluded.name_nl, parent_id = excluded.parent_id, order_index = excluded.order_index;

-- ── 3. Soorten (niveau 3): bestaande verhangen, nieuwe toevoegen ───────────
-- Eén lijst voor allebei: een bestaande slug krijgt via on conflict zijn
-- nieuwe ouder, naam en plek; koppelingen met merken en collecties blijven.

insert into product_categories (slug, name, name_nl, parent_id, order_index)
select v.slug, v.name, v.name_nl, p.id, v.ord
from (values
  -- Meubels › Banken & fauteuils
  ('sofa',                  'Sofas',                      'Banken',                       'sofas-armchairs', 1),
  ('corner-sofas',          'Corner sofas',               'Hoekbanken',                   'sofas-armchairs', 2),
  ('armchair',              'Armchairs',                  'Fauteuils',                    'sofas-armchairs', 3),
  ('lounge-chair',          'Lounge chairs',              'Loungestoelen',                'sofas-armchairs', 4),
  ('chaise-longues',        'Chaise longues',             'Chaises longues',              'sofas-armchairs', 5),
  ('daybeds',               'Daybeds',                    'Daybeds',                      'sofas-armchairs', 6),
  ('poufs',                 'Poufs & footstools',         'Poefs & hockers',              'sofas-armchairs', 7),
  ('sofa-beds',             'Sofa beds',                  'Slaapbanken',                  'sofas-armchairs', 8),
  -- Meubels › Tafels & stoelen
  ('dining-table',          'Dining tables',              'Eettafels',                    'tables-chairs', 1),
  ('dining-chair',          'Dining chairs',              'Eetkamerstoelen',              'tables-chairs', 2),
  ('bar-stool',             'Bar stools',                 'Barkrukken',                   'tables-chairs', 3),
  ('bench',                 'Benches',                    'Bankjes',                      'tables-chairs', 4),
  ('coffee-table',          'Coffee tables',              'Salontafels',                  'tables-chairs', 5),
  ('side-table',            'Side tables',                'Bijzettafels',                 'tables-chairs', 6),
  ('console',               'Console tables',             'Consoletafels',                'tables-chairs', 7),
  -- Meubels › Kasten
  ('sideboard',             'Sideboards',                 'Dressoirs',                    'storage', 1),
  ('highboards',            'Highboards',                 'Highboards',                   'storage', 2),
  ('bookshelf',             'Bookcases',                  'Boekenkasten',                 'storage', 3),
  ('wall-units',            'Wall units',                 'Wandsystemen',                 'storage', 4),
  ('tv-units',              'TV units',                   'Tv-meubels',                   'storage', 5),
  ('display-cabinets',      'Display cabinets',           'Vitrinekasten',                'storage', 6),
  ('hallway-units',         'Hallway units',              'Halmeubels',                   'storage', 7),
  -- Meubels › Slaapkamer
  ('beds',                  'Beds',                       'Bedden',                       'bedroom', 1),
  ('headboard',             'Headboards',                 'Hoofdborden',                  'bedroom', 2),
  ('bedside-tables',        'Bedside tables',             'Nachtkastjes',                 'bedroom', 3),
  ('wardrobe',              'Wardrobes',                  'Kledingkasten',                'bedroom', 4),
  ('walk-in-wardrobes',     'Walk-in wardrobes',          'Inloopkasten',                 'bedroom', 5),
  ('chests-of-drawers',     'Chests of drawers',          'Ladekasten',                   'bedroom', 6),
  ('dressing-tables',       'Dressing tables',            'Kaptafels',                    'bedroom', 7),
  -- Meubels › Werkplek
  ('desk',                  'Desks',                      'Bureaus',                      'workspace', 1),
  ('office-chairs',         'Office chairs',              'Bureaustoelen',                'workspace', 2),
  ('secretary-desks',       'Secretary desks',            'Secretaires',                  'workspace', 3),

  -- Verlichting › Binnenverlichting
  ('pendant',               'Pendant lamps',              'Hanglampen',                   'indoor-lighting', 1),
  ('ceiling-light',         'Ceiling lamps',              'Plafondlampen',                'indoor-lighting', 2),
  ('wall-lamp',             'Wall lamps',                 'Wandlampen',                   'indoor-lighting', 3),
  ('floor-lamp',            'Floor lamps',                'Vloerlampen',                  'indoor-lighting', 4),
  ('table-lamp',            'Table lamps',                'Tafellampen',                  'indoor-lighting', 5),
  ('spotlights',            'Spotlights & recessed',      'Spots & inbouw',               'indoor-lighting', 6),
  ('linear-lighting',       'Linear lighting',            'Lichtlijnen',                  'indoor-lighting', 7),
  ('track-lighting',        'Track lighting',             'Railverlichting',              'indoor-lighting', 8),
  -- Verlichting › Buitenverlichting
  ('outdoor-wall-lamps',    'Outdoor wall lamps',         'Buitenwandlampen',             'outdoor-lighting', 1),
  ('outdoor-ceiling-lamps', 'Outdoor ceiling lamps',      'Buitenplafondlampen',          'outdoor-lighting', 2),
  ('outdoor-floor-lamps',   'Outdoor floor lamps',        'Buitenvloerlampen',            'outdoor-lighting', 3),
  ('outdoor-table-lamps',   'Outdoor table lamps',        'Buitentafellampen',            'outdoor-lighting', 4),
  ('bollard-lights',        'Bollard lights',             'Paalverlichting',              'outdoor-lighting', 5),
  ('ground-spots',          'Ground spots',               'Grondspots',                   'outdoor-lighting', 6),
  ('step-lights',           'Step lights',                'Trapverlichting',              'outdoor-lighting', 7),

  -- Keuken › Keukens
  ('fitted-kitchens',       'Kitchens',                   'Keukens',                      'kitchens', 1),
  ('kitchen-islands',       'Kitchen islands',            'Kookeilanden',                 'kitchens', 2),
  ('freestanding-kitchen-units', 'Freestanding kitchen units', 'Vrijstaande keukenelementen', 'kitchens', 3),
  ('cabinetry',             'Kitchen cabinets',           'Keukenkasten',                 'kitchens', 4),
  -- Keuken › Werkbladen
  ('worktops',              'Worktops',                   'Werkbladen',                   'countertops', 1),
  ('splashbacks',           'Splashbacks',                'Spatwanden',                   'countertops', 2),
  -- Keuken › Spoelbakken & kranen
  ('kitchen-sinks',         'Sinks',                      'Spoelbakken',                  'sinks-taps', 1),
  ('kitchen-faucets',       'Kitchen taps',               'Keukenkranen',                 'sinks-taps', 2),
  ('boiling-water-taps',    'Boiling water taps',         'Kokendwaterkranen',            'sinks-taps', 3),
  -- Keuken › Apparatuur
  ('hobs',                  'Hobs',                       'Kookplaten',                   'kitchen-appliances', 1),
  ('ovens',                 'Ovens & steam ovens',        'Ovens & stoomovens',           'kitchen-appliances', 2),
  ('range-cookers',         'Range cookers',              'Fornuizen',                    'kitchen-appliances', 3),
  ('ventilation',           'Extractor hoods',            'Afzuiging',                    'kitchen-appliances', 4),
  ('refrigeration',         'Refrigeration',              'Koelen & vriezen',             'kitchen-appliances', 5),
  ('wine-coolers',          'Wine coolers',               'Wijnklimaatkasten',            'kitchen-appliances', 6),
  ('dishwashers',           'Dishwashers',                'Vaatwassers',                  'kitchen-appliances', 7),
  ('coffee-machines',       'Coffee machines',            'Koffiemachines',               'kitchen-appliances', 8),
  -- Keuken › Keukenaccessoires
  ('drawer-organisers',     'Drawer organisers',          'Lade-indeling',                'kitchen-accessories', 1),
  ('kitchen-rails',         'Rails & wall shelves',       'Keukenrails & wandplanken',    'kitchen-accessories', 2),
  ('waste-systems',         'Waste systems',              'Afvalsystemen',                'kitchen-accessories', 3),
  ('chopping-boards',       'Chopping boards',            'Snijplanken',                  'kitchen-accessories', 4),
  ('kitchen-textiles',      'Kitchen textiles',           'Keukentextiel',                'kitchen-accessories', 5),
  -- Keuken › Tafel & koken
  ('dinnerware',            'Dinnerware',                 'Servies',                      'tableware-cookware', 1),
  ('glassware',             'Glassware',                  'Glaswerk',                     'tableware-cookware', 2),
  ('cutlery',               'Cutlery',                    'Bestek',                       'tableware-cookware', 3),
  ('serveware',             'Serveware',                  'Serveergoed',                  'tableware-cookware', 4),
  ('cookware',              'Cookware',                   'Pannen',                       'tableware-cookware', 5),
  ('kitchen-utensils',      'Kitchen utensils',           'Kookgerei',                    'tableware-cookware', 6),

  -- Badkamer › Sanitair
  ('washbasins',            'Washbasins',                 'Wastafels',                    'bathroom-fixtures', 1),
  ('toilets',               'Toilets',                    'Toiletten',                    'bathroom-fixtures', 2),
  ('bidets',                'Bidets',                     'Bidets',                       'bathroom-fixtures', 3),
  ('bathtubs',              'Bathtubs',                   'Baden',                        'bathroom-fixtures', 4),
  ('shower-trays',          'Shower trays',               'Douchebakken',                 'bathroom-fixtures', 5),
  -- Badkamer › Douches
  ('shower-enclosures',     'Shower enclosures',          'Douchewanden',                 'showers', 1),
  ('rain-showers',          'Rain showers',               'Regendouches',                 'showers', 2),
  ('shower-panels',         'Shower panels',              'Douchepanelen',                'showers', 3),
  ('shower-drains',         'Shower drains',              'Douchegoten',                  'showers', 4),
  -- Badkamer › Kranen
  ('basin-taps',            'Basin taps',                 'Wastafelkranen',               'bathroom-fittings', 1),
  ('bath-taps',             'Bath taps',                  'Badkranen',                    'bathroom-fittings', 2),
  ('shower-taps',           'Shower taps & thermostats',  'Douchekranen & thermostaten',  'bathroom-fittings', 3),
  -- Badkamer › Badmeubels
  ('vanity-units',          'Vanity units',               'Wastafelmeubels',              'vanities', 1),
  ('vanity-tops',           'Vanity tops',                'Wastafelbladen',               'vanities', 2),
  ('bathroom-cabinets',     'Bathroom cabinets',          'Badkamerkasten',               'vanities', 3),
  ('bathroom-mirrors',      'Bathroom mirrors',           'Spiegels',                     'vanities', 4),
  -- Badkamer › Accessoires
  ('towel-radiators',       'Towel radiators',            'Handdoekradiatoren',           'bathroom-accessories', 1),
  ('bath-accessories',      'Bathroom accessories',       'Badkameraccessoires',          'bathroom-accessories', 2),
  ('bathroom-lighting',     'Bathroom lighting',          'Badkamerverlichting',          'bathroom-accessories', 3),

  -- Wellness › Sauna & stoom
  ('saunas',                'Saunas',                     'Sauna''s',                     'sauna-steam', 1),
  ('infrared-cabins',       'Infrared cabins',            'Infraroodcabines',             'sauna-steam', 2),
  ('steam-rooms',           'Steam rooms',                'Stoomcabines',                 'sauna-steam', 3),
  ('hammams',               'Hammams',                    'Hammams',                      'sauna-steam', 4),
  -- Wellness › Spa's
  ('hot-tubs',              'Hot tubs',                   'Hottubs',                      'spas', 1),
  ('swim-spas',             'Swim spas',                  'Swimspa''s',                   'spas', 2),
  -- Wellness › Zwembaden
  ('swimming-pools',        'Swimming pools',             'Zwembaden',                    'pools', 1),
  ('indoor-pools',          'Indoor pools',               'Binnenzwembaden',              'pools', 2),
  ('minipools',             'Minipools',                  'Minipools',                    'pools', 3),
  ('pool-covers',           'Pool covers',                'Zwembadafdekking',             'pools', 4),
  ('outdoor-showers',       'Outdoor showers',            'Buitendouches',                'pools', 5),

  -- Buiten › Tuinmeubels
  ('outdoor-lounge-seating','Lounge sets',                'Loungesets',                   'outdoor-furniture', 1),
  ('outdoor-sofas',         'Garden sofas',               'Loungebanken',                 'outdoor-furniture', 2),
  ('outdoor-lounge-chairs', 'Garden lounge chairs',       'Loungestoelen',                'outdoor-furniture', 3),
  ('outdoor-tables',        'Garden tables',              'Tuintafels',                   'outdoor-furniture', 4),
  ('outdoor-chairs',        'Garden chairs',              'Tuinstoelen',                  'outdoor-furniture', 5),
  ('outdoor-benches',       'Garden benches',             'Tuinbankjes',                  'outdoor-furniture', 6),
  ('sun-loungers',          'Sun loungers',               'Ligbedden',                    'outdoor-furniture', 7),
  ('outdoor-daybeds',       'Outdoor daybeds',            'Daybeds',                      'outdoor-furniture', 8),
  ('outdoor-bar-stools',    'Garden bar stools',          'Barkrukken',                   'outdoor-furniture', 9),
  -- Buiten › Buitenkoken
  ('outdoor-kitchens',      'Outdoor kitchens',           'Buitenkeukens',                'outdoor-cooking', 1),
  ('bbq-grills',            'Barbecues',                  'Barbecues',                    'outdoor-cooking', 2),
  ('pizza-ovens',           'Pizza ovens',                'Pizzaovens',                   'outdoor-cooking', 3),
  -- Buiten › Vuur & warmte
  ('outdoor-fireplaces',    'Outdoor fireplaces',         'Buitenhaarden',                'fire-heat', 1),
  ('fire-pits',             'Fire pits',                  'Vuurschalen',                  'fire-heat', 2),
  ('outdoor-heating',       'Patio heaters',              'Terrasverwarming',             'fire-heat', 3),
  -- Buiten › Schaduw & overkapping
  ('parasols',              'Parasols',                   'Parasols',                     'shade', 1),
  ('pergolas',              'Pergolas & louvred roofs',   'Pergola''s & lamellendaken',   'shade', 2),
  ('awnings',               'Awnings',                    'Zonneschermen',                'shade', 3),
  ('shade-sails',           'Shade sails',                'Schaduwdoeken',                'shade', 4),
  ('garden-rooms',          'Garden rooms & pool houses', 'Tuinkamers & poolhouses',      'shade', 5),
  -- Buiten › Tuinaccessoires
  ('planters',              'Planters',                   'Plantenbakken',                'garden-accessories', 1),
  ('outdoor-rugs',          'Outdoor rugs',               'Buitenkleden',                 'garden-accessories', 2),

  -- Decor & textiel
  ('mirrors',               'Mirrors',                    'Spiegels',                     'home-accessories', 1),
  ('vases',                 'Vases',                      'Vazen',                        'home-accessories', 2),
  ('decorative-objects',    'Objects',                    'Objecten',                     'home-accessories', 3),
  ('candles',               'Candles & holders',          'Kaarsen & houders',            'home-accessories', 4),
  ('clocks',                'Clocks',                     'Klokken',                      'home-accessories', 5),
  ('rugs',                  'Rugs',                       'Vloerkleden',                  'textiles', 1),
  ('cushions',              'Cushions',                   'Kussens',                      'textiles', 2),
  ('throws',                'Throws',                     'Plaids',                       'textiles', 3),
  ('upholstery-fabrics',    'Upholstery fabrics',         'Meubelstoffen',                'textiles', 4),
  ('curtains',              'Curtains',                   'Gordijnen',                    'window-treatments', 1),
  ('roller-blinds',         'Roller blinds',              'Rolgordijnen',                 'window-treatments', 2),
  ('pleated-blinds',        'Pleated blinds',             'Plissés',                      'window-treatments', 3),
  ('venetian-blinds',       'Venetian blinds',            'Jaloezieën',                   'window-treatments', 4),
  ('art-prints',            'Art & prints',               'Kunst & prints',               'art', 1),
  ('sculptures',            'Sculptures',                 'Sculpturen',                   'art', 2),

  -- Afwerking
  ('parquet',               'Parquet',                    'Parket',                       'floors', 1),
  ('stone-floors',          'Natural stone',              'Natuursteen',                  'floors', 2),
  ('ceramic-floor-tiles',   'Ceramic tiles',              'Keramische tegels',            'floors', 3),
  ('poured-floors',         'Poured floors',              'Gietvloeren',                  'floors', 4),
  ('carpet',                'Carpet',                     'Tapijt',                       'floors', 5),
  ('wall-tiles',            'Wall tiles',                 'Wandtegels',                   'walls', 1),
  ('wallpaper',             'Wallpaper',                  'Behang',                       'walls', 2),
  ('wall-panels',           'Wall panels',                'Wandpanelen',                  'walls', 3),
  ('plaster-paint',         'Plaster & lime paint',       'Stuc & kalkverf',              'walls', 4),
  ('interior-doors',        'Interior doors',             'Binnendeuren',                 'doors', 1),
  ('pivot-doors',           'Pivot doors',                'Taatsdeuren',                  'doors', 2),
  ('sliding-doors',         'Sliding doors',              'Schuifdeuren',                 'doors', 3),
  ('front-doors',           'Front doors',                'Voordeuren',                   'doors', 4),
  ('staircases',            'Staircases',                 'Trappen',                      'stairs', 1),
  ('balustrades',           'Balustrades & handrails',    'Balustrades & leuningen',      'stairs', 2),
  ('gas-fireplaces',        'Gas fireplaces',             'Gashaarden',                   'indoor-fireplaces', 1),
  ('wood-fireplaces',       'Wood fireplaces',            'Houthaarden',                  'indoor-fireplaces', 2),
  ('electric-fireplaces',   'Electric fireplaces',        'Elektrische haarden',          'indoor-fireplaces', 3),
  ('bioethanol-fireplaces', 'Bioethanol fireplaces',      'Bio-ethanolhaarden',           'indoor-fireplaces', 4),
  ('design-radiators',      'Design radiators',           'Designradiatoren',             'radiators', 1),
  ('convectors',            'Convectors',                 'Convectoren',                  'radiators', 2),
  ('door-handles',          'Door handles',               'Deurklinken',                  'hardware', 1),
  ('cabinet-handles',       'Handles',                    'Greepjes',                     'hardware', 2),
  ('switches-sockets',      'Switches & sockets',         'Schakelaars & stopcontacten',  'hardware', 3),

  -- Bouw & techniek
  ('windows',               'Windows',                    'Ramen',                        'windows-glazing', 1),
  ('sliding-glass-doors',   'Sliding glass doors',        'Schuifpuien',                  'windows-glazing', 2),
  ('minimal-frames',        'Minimal frames',             'Minimale kozijnen',            'windows-glazing', 3),
  ('roof-windows',          'Roof windows',               'Dakramen',                     'windows-glazing', 4),
  ('facade-cladding',       'Facade cladding',            'Gevelbekleding',               'facade-roof', 1),
  ('roofing',               'Roofing',                    'Dakbedekking',                 'facade-roof', 2),
  ('exterior-shading',      'Exterior sun shading',       'Buitenzonwering',              'facade-roof', 3),
  ('home-automation',       'Home automation',            'Domotica',                     'installations', 1),
  ('audio',                 'Audio',                      'Audio',                        'installations', 2),
  ('climate',               'Climate',                    'Klimaat',                      'installations', 3),
  ('home-lifts',            'Home lifts',                 'Huisliften',                   'installations', 4)
) as v(slug, name, name_nl, parent, ord)
join product_categories p on p.slug = v.parent
on conflict (slug) do update set name = excluded.name, name_nl = excluded.name_nl, parent_id = excluded.parent_id, order_index = excluded.order_index;

-- ── 4. Soorten van collecties bijwerken ────────────────────────────────────
-- Tuincollecties (Dedon, Tribù) droegen binnensoorten naast tuinsoorten.
-- Elke binnensoort wordt zijn buitenvariant, alleen bij collecties onder
-- Tuinmeubels. Per paar één statement: twee binnensoorten met dezelfde
-- buitenvariant (Fauteuils en Loungestoelen) botsen anders op de sleutel.
-- Een binnensoort waarvan de buitenvariant er al is, blijft staan en gaat
-- in deel B weg.

do $$
declare
  m record;
  outdoor uuid := (select id from product_categories where slug = 'outdoor-furniture');
begin
  for m in select * from (values
    ('lounge-chair', 'outdoor-lounge-chairs'),
    ('armchair',     'outdoor-lounge-chairs'),
    ('sofa',         'outdoor-sofas'),
    ('bench',        'outdoor-benches'),
    ('dining-chair', 'outdoor-chairs'),
    ('bar-stool',    'outdoor-bar-stools'),
    ('dining-table', 'outdoor-tables'),
    ('coffee-table', 'outdoor-tables'),
    ('side-table',   'outdoor-tables')
  ) as t(src, dst) loop
    update product_collection_kinds k
       set category_id = (select id from product_categories where slug = m.dst)
     where k.category_id = (select id from product_categories where slug = m.src)
       and k.collection_id in (
         select pc.id from product_collections pc
          where pc.category_id = outdoor
             or exists (select 1 from product_collection_kinds k2 join product_categories c2 on c2.id = k2.category_id
                         where k2.collection_id = pc.id and c2.parent_id = outdoor))
       and not exists (
         select 1 from product_collection_kinds k3
          where k3.collection_id = k.collection_id
            and k3.category_id = (select id from product_categories where slug = m.dst));
  end loop;
end $$;

-- Buitenmerken (Dedon, Tribù) dragen buitensoorten, ook bij collecties die
-- niet onder Tuinmeubels hingen (IZON, Porcini, Satellite, SOLYD, ombii).
do $$
declare m record;
begin
  for m in select * from (values
    ('lounge-chair', 'outdoor-lounge-chairs'), ('armchair', 'outdoor-lounge-chairs'),
    ('sofa', 'outdoor-sofas'), ('bench', 'outdoor-benches'), ('dining-chair', 'outdoor-chairs'),
    ('bar-stool', 'outdoor-bar-stools'), ('dining-table', 'outdoor-tables'),
    ('coffee-table', 'outdoor-tables'), ('side-table', 'outdoor-tables'),
    ('table-lamp', 'outdoor-table-lamps'), ('floor-lamp', 'outdoor-floor-lamps'),
    ('wall-lamp', 'outdoor-wall-lamps'), ('pendant', 'outdoor-ceiling-lamps')
  ) as t(src, dst) loop
    update product_collection_kinds k
       set category_id = (select id from product_categories where slug = m.dst)
     where k.category_id = (select id from product_categories where slug = m.src)
       and k.collection_id in (select pc.id from product_collections pc join brands b on b.id = pc.brand_id where b.name in ('DEDON', 'Tribù'))
       and not exists (select 1 from product_collection_kinds k3 where k3.collection_id = k.collection_id
                        and k3.category_id = (select id from product_categories where slug = m.dst));
  end loop;
end $$;

-- "Tuintafels & stoelen" was één soort; nu twee. Wie Tuintafels heeft
-- (voorheen tafels én stoelen), krijgt Tuinstoelen erbij.
insert into product_collection_kinds (collection_id, category_id, position)
select k.collection_id, (select id from product_categories where slug = 'outdoor-chairs'), k.position + 1
from product_collection_kinds k
where k.category_id = (select id from product_categories where slug = 'outdoor-tables')
on conflict do nothing;

-- Buitenlamp met de binnensoort Vloerlampen (Dedon Loon).
update product_collection_kinds k
   set category_id = (select id from product_categories where slug = 'outdoor-floor-lamps')
 where k.category_id = (select id from product_categories where slug = 'floor-lamp')
   and k.collection_id in (select pc.id from product_collections pc
                            join product_categories c on c.id = pc.category_id
                           where c.slug = 'outdoor-lighting')
   and not exists (select 1 from product_collection_kinds k3 where k3.collection_id = k.collection_id
                    and k3.category_id = (select id from product_categories where slug = 'outdoor-floor-lamps'));

-- Collecties zonder soort die er nu een kunnen krijgen.
insert into product_collection_kinds (collection_id, category_id, position)
select pc.id, (select id from product_categories where slug = v.kind), 0
from product_collections pc
join brands b on b.id = pc.brand_id
join (values
  ('Compass Pools', null,          'swimming-pools'),
  ('Drop',          'Sauna',       'saunas'),
  ('Drop',          'Drop Sauna',  'saunas'),
  ('Drop',          'Spa',         'hot-tubs'),
  ('Moooi',         'Digital Garden', 'wallpaper')
) as v(brand, collection, kind) on v.brand = b.name and (v.collection is null or v.collection = pc.name)
where not exists (select 1 from product_collection_kinds k where k.collection_id = pc.id)
on conflict do nothing;

-- ── 5. De groep van elke collectie volgt zijn soorten ──────────────────────
-- Zelfde regel als updateProductCollectionKinds: één soort → die soort,
-- meer → de laagste categorie die ze allemaal omvat.

do $$
declare
  col record;
  kind_ids uuid[];
  common uuid[];
  chain uuid[];
  cur uuid;
  i int;
begin
  for col in select distinct collection_id from product_collection_kinds loop
    select array_agg(category_id order by position) into kind_ids
      from product_collection_kinds where collection_id = col.collection_id;
    common := null;
    for i in 1 .. array_length(kind_ids, 1) loop
      chain := array[]::uuid[];
      cur := kind_ids[i];
      while cur is not null loop
        chain := chain || cur;
        select parent_id into cur from product_categories where id = cur;
      end loop;
      if common is null then
        common := chain;
      else
        common := array(select x from unnest(common) with ordinality as u(x, o) where x = any(chain) order by o);
      end if;
    end loop;
    -- Geen gemeenschappelijke categorie (een tuincollectie die tot deel B
    -- nog een binnensoort draagt): laten staan wat er was.
    if common[1] is not null then
      update product_collections set category_id = common[1] where id = col.collection_id;
    end if;
  end loop;
end $$;

commit;

-- ── Deel B — handmatig uitvoeren (verwijdert rijen) ────────────────────────
-- Binnensoorten die bij tuincollecties zijn blijven staan omdat hun
-- buitenvariant er al was (bijv. Fauteuils naast Loungestoelen, die beide
-- Loungestoelen werden). Na het uitvoeren: merkcategorieën opnieuw afleiden
-- (scripts/resync-brand-categories.ts).
--
-- delete from product_collection_kinds k
--  using product_categories c
--  where c.id = k.category_id
--    and c.slug in ('lounge-chair','armchair','sofa','bench','dining-chair','bar-stool','dining-table','coffee-table','side-table',
--                   'table-lamp','floor-lamp','wall-lamp','pendant')
--    and k.collection_id in (
--      select pc.id from product_collections pc
--       join brands b on b.id = pc.brand_id
--       left join product_categories g on g.id = pc.category_id
--      where b.name in ('DEDON', 'Tribù')
--         or g.slug = 'outdoor-furniture'
--         or g.parent_id = (select id from product_categories where slug = 'outdoor-furniture'));
