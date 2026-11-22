-- 306: één naam per professionele categorie.
--
-- De categorienaam (Keukens, Zwembaden) overlapte met de ruimtes en stuurde
-- professionals naar de verkeerde keuze ("Meubels"). De naam is nu het
-- beroep (Keukenstudio, Zwembadbouwer), op alle plekken gelijk. Het
-- meervoud blijft apart (pro_name_plural*) voor koppen en menu's.
-- De slugs blijven staan, dus geen URL verandert.

UPDATE public.categories SET name = pro_name, name_nl = pro_name_nl, updated_at = now()
WHERE category_type = 'Professional' AND category_hierarchy = 2 AND pro_name IS NOT NULL;

UPDATE public.categories c SET
  name = v.en, name_nl = v.nl, pro_name = v.en, pro_name_nl = v.nl, pro_name_plural = v.en_pl, pro_name_plural_nl = v.nl_pl
FROM (VALUES
  ('garden-designer',     'Garden designer',        'Tuinontwerper',           'Garden designers',        'Tuinontwerpers'),
  ('tiles-stones',        'Tile store',             'Tegelwinkel',             'Tile stores',             'Tegelwinkels'),
  ('windows-doors',       'Window & door supplier', 'Kozijnenleverancier',     'Window & door suppliers', 'Kozijnenleveranciers'),
  ('wellness',            'Wellness builder',       'Wellnessbouwer',          'Wellness builders',       'Wellnessbouwers'),
  ('heating-ventilation', 'Heating installer',      'Verwarmingsinstallateur', 'Heating installers',      'Verwarmingsinstallateurs'),
  ('security-systems',    'Security company',       'Beveiligingsbedrijf',     'Security companies',      'Beveiligingsbedrijven')
) AS v(slug, en, nl, en_pl, nl_pl)
WHERE c.category_type = 'Professional' AND c.slug = v.slug;

-- mv_professional_summary slaat de naam op: verversen.
SELECT public.refresh_all_materialized_views();

-- De losse beroepsnaam-kolommen zijn overbodig nu name/name_nl het beroep zijn.
-- (Via de Supabase-console uit te voeren; de MCP weigert DROP.)
ALTER TABLE public.categories DROP COLUMN IF EXISTS pro_name, DROP COLUMN IF EXISTS pro_name_nl;
