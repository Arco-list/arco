-- 302: twee namen per dienst.
--
-- Een dienst heeft een categorienaam (Zwembaden) voor filters, menu's en
-- de bedrijfspagina, en een beroepsnaam (Zwembadbouwer, meervoud
-- Zwembadbouwers) voor koppen boven de professionals-discover, de
-- kaarten op home en het headermenu. De beroepsnamen stonden hardcoded
-- in lib/professional-hubs.ts (SERVICE_PLURALS); vanaf nu staan ze in de
-- taxonomie en bewerk je ze in de admin, met de code als terugval.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS pro_name text,
  ADD COLUMN IF NOT EXISTS pro_name_nl text,
  ADD COLUMN IF NOT EXISTS pro_name_plural text,
  ADD COLUMN IF NOT EXISTS pro_name_plural_nl text;

COMMENT ON COLUMN public.categories.pro_name IS 'Beroepsnaam enkelvoud (EN): Pool builder. Alleen voor diensten (category_type = Professional).';
COMMENT ON COLUMN public.categories.pro_name_plural IS 'Beroepsnaam meervoud (EN): Pool builders — koppen en menu''s.';

WITH seed(slug, en, nl, en_pl, nl_pl) AS (VALUES
  ('architect',           'Architect',               'Architect',                 'Architects',                'Architecten'),
  ('interior-designer',   'Interior designer',       'Interieurarchitect',        'Interior designers',        'Interieurarchitecten'),
  ('garden-designer',     'Garden designer',         'Tuinarchitect',             'Garden designers',          'Tuinarchitecten'),
  ('lighting-designer',   'Lighting designer',       'Lichtontwerper',            'Lighting designers',        'Lichtontwerpers'),
  ('photographer',        'Photographer',            'Fotograaf',                 'Photographers',             'Fotografen'),
  ('structural-engineer', 'Structural engineer',     'Constructeur',              'Structural engineers',      'Constructeurs'),
  ('builder',             'Builder',                 'Aannemer',                  'Builders',                  'Aannemers'),
  ('roofing',             'Roofer',                  'Dakdekker',                 'Roofers',                   'Dakdekkers'),
  ('kitchens',            'Kitchen studio',          'Keukenstudio',              'Kitchen studios',           'Keukenstudio''s'),
  ('bathrooms',           'Bathroom studio',         'Badkamerstudio',            'Bathroom studios',          'Badkamerstudio''s'),
  ('swimming-pools',      'Pool builder',            'Zwembadbouwer',             'Pool builders',             'Zwembadbouwers'),
  ('wellness',            'Wellness studio',         'Wellnessstudio',            'Wellness studios',          'Wellnessstudio''s'),
  ('tiles-stones',        'Tiler & stonemason',      'Tegelzetter & steenhouwer', 'Tilers & stonemasons',      'Tegelzetters & steenhouwers'),
  ('windows-doors',       'Window & door maker',     'Kozijnmaker',               'Window & door makers',      'Kozijnmakers'),
  ('stairs-elevator',     'Stair maker',             'Trappenmaker',              'Stair makers',              'Trappenmakers'),
  ('interior-stylist',    'Interior stylist',        'Interieurstylist',          'Interior stylists',         'Interieurstylisten'),
  ('cabinet-maker',       'Cabinet maker',           'Meubelmaker',               'Cabinet makers',            'Meubelmakers'),
  ('painter',             'Painter',                 'Schilder',                  'Painters',                  'Schilders'),
  ('upholstery',          'Upholsterer',             'Stoffeerder',               'Upholsterers',              'Stoffeerders'),
  ('furniture',           'Furniture store',         'Meubelwinkel',              'Furniture stores',          'Meubelwinkels'),
  ('lighting',            'Lighting store',          'Verlichtingswinkel',        'Lighting stores',           'Verlichtingswinkels'),
  ('flooring',            'Flooring store',          'Vloerenwinkel',             'Flooring stores',           'Vloerenwinkels'),
  ('fireplace',           'Fireplace store',         'Haardenwinkel',             'Fireplace stores',          'Haardenwinkels'),
  ('art',                 'Gallery',                 'Galerie',                   'Galleries',                 'Galeries'),
  ('gardener',            'Gardener',                'Hovenier',                  'Gardeners',                 'Hoveniers'),
  ('shed-builder',        'Garden house builder',    'Tuinhuisbouwer',            'Garden house builders',     'Tuinhuisbouwers'),
  ('outdoor-furniture',   'Outdoor furniture store', 'Tuinmeubelwinkel',          'Outdoor furniture stores',  'Tuinmeubelwinkels'),
  ('outdoor-lighting',    'Outdoor lighting store',  'Buitenverlichtingswinkel',  'Outdoor lighting stores',   'Buitenverlichtingswinkels'),
  ('fencing-gates',       'Fence & gate installer',  'Hekwerkinstallateur',       'Fence & gate installers',   'Hekwerkinstallateurs'),
  ('electrical-systems',  'Electrician',             'Elektricien',               'Electricians',              'Elektriciens'),
  ('heating-ventilation', 'HVAC installer',          'Installateur',              'HVAC installers',           'Installateurs'),
  ('security-systems',    'Security installer',      'Beveiligingsinstallateur',  'Security installers',       'Beveiligingsinstallateurs'),
  ('smart-homes',         'Smart home installer',    'Domotica-installateur',     'Smart home installers',     'Domotica-installateurs'),
  ('solar-installer',     'Solar installer',         'Zonnepaneelinstallateur',   'Solar installers',          'Zonnepaneelinstallateurs')
)
UPDATE public.categories c
SET pro_name = s.en, pro_name_nl = s.nl, pro_name_plural = s.en_pl, pro_name_plural_nl = s.nl_pl
FROM seed s
WHERE c.slug = s.slug AND c.category_type = 'Professional' AND c.pro_name IS NULL;

-- De categorienaam van de schuurenbouwer volgt het patroon van de andere
-- diensten (Keukens, Zwembaden): het dingwoord, niet het beroep.
UPDATE public.categories SET name = 'Garden houses', name_nl = 'Tuinhuizen'
WHERE category_type = 'Professional' AND slug = 'shed-builder';
