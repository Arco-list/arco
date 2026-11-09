-- 295_product_families_category.sql
--
-- De soort van een serie: Mito is verlichting, b3 een keuken. Daarmee
-- krijgt het Producten-menu zijn rijen (soorten, niet merknamen) en de
-- soortpagina haar series over merken heen. De categorie mag een
-- hoofdgroep zijn als een serie meerdere soorten beslaat (Mito is hang-,
-- wand- én vloerlamp): dan "Verlichting".
--
-- product_categories had alleen Engelse namen; name_nl erbij, gevuld
-- voor alle 61, zodat het menu en de pagina's Nederlands kunnen spreken.

ALTER TABLE public.product_families
  ADD COLUMN category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL;
CREATE INDEX product_families_category_idx ON public.product_families (category_id);

ALTER TABLE public.product_categories ADD COLUMN name_nl text;

UPDATE public.product_categories AS c SET name_nl = v.name_nl
FROM (VALUES
  -- hoofdgroepen
  ('furniture', 'Meubels'), ('lighting', 'Verlichting'), ('kitchen', 'Keuken'),
  ('bathroom', 'Badkamer'), ('outdoor', 'Buiten'), ('finishes', 'Afwerking'),
  -- meubels
  ('seating', 'Zitmeubels'), ('tables', 'Tafels'), ('storage', 'Kasten'), ('beds', 'Bedden'),
  ('lounge-chair', 'Loungestoelen'), ('dining-chair', 'Eetkamerstoelen'), ('bar-stool', 'Barkrukken'),
  ('sofa', 'Banken'), ('armchair', 'Fauteuils'), ('bench', 'Bankjes'),
  ('dining-table', 'Eettafels'), ('coffee-table', 'Salontafels'), ('side-table', 'Bijzettafels'),
  ('console', 'Consoletafels'), ('desk', 'Bureaus'),
  ('bookshelf', 'Boekenkasten'), ('cabinet', 'Kasten'), ('sideboard', 'Dressoirs'), ('wardrobe', 'Kledingkasten'),
  ('bed-frame', 'Bedframes'), ('headboard', 'Hoofdborden'),
  -- verlichting
  ('pendant', 'Hanglampen'), ('floor-lamp', 'Vloerlampen'), ('table-lamp', 'Tafellampen'),
  ('wall-lamp', 'Wandlampen'), ('ceiling-light', 'Plafondlampen'), ('outdoor-lighting', 'Buitenverlichting'),
  -- keuken
  ('cabinetry', 'Keukenkasten'), ('kitchen-islands', 'Kookeilanden'), ('countertops', 'Werkbladen'),
  ('kitchen-faucets', 'Kranen'), ('kitchen-sinks', 'Spoelbakken'), ('kitchen-appliances', 'Apparatuur'),
  ('cooktops-ovens', 'Kookplaten & ovens'), ('refrigeration', 'Koelen'), ('dishwashers', 'Vaatwassers'),
  ('ventilation', 'Afzuiging'),
  -- badkamer
  ('bathroom-fittings', 'Kranen'), ('bathroom-fixtures', 'Sanitair'), ('vanities', 'Badmeubels'),
  ('showers', 'Douches'), ('bathroom-accessories', 'Accessoires'),
  -- buiten
  ('outdoor-furniture', 'Tuinmeubels'), ('outdoor-lounge-seating', 'Loungesets'),
  ('outdoor-dining', 'Tuintafels & stoelen'), ('sun-loungers', 'Ligbedden'),
  ('bbq-grills', 'Barbecues'), ('outdoor-fireplaces', 'Buitenhaarden'), ('pools', 'Zwembaden'),
  ('spas-saunas', 'Spa''s & sauna''s'), ('outdoor-heating', 'Terrasverwarming'),
  -- afwerking
  ('doors', 'Deuren'), ('radiators', 'Radiatoren'), ('indoor-fireplaces', 'Haarden'), ('hardware', 'Beslag')
) AS v(slug, name_nl)
WHERE c.slug = v.slug;
