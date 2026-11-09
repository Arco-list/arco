-- 299: tuinhuis is een ruimte, geen gebouwtype.
--
-- Een tuinhuis, buitenverblijf of poolhouse is een secundair object in de
-- tuin dat bij een primair object hoort (de villa). Staat het op zichzelf,
-- dan is het een bungalow, chalet of huis. Zwembad was al zo ingericht;
-- tuinhuis volgt. Schuurenbouwers publiceren hun deelprojecten onder deze
-- ruimte. Code: lib/spaces.ts, lib/type-labels.ts, lib/project-hubs.ts
-- (hub /projects/tuinhuizen), components/filter-bar.tsx, icoon
-- garden_house in lib/icons/project-features.ts; het gebouwtype is uit
-- lib/project-translations.ts, lib/project-details.ts en de importprompts.

UPDATE public.spaces SET sort_order = sort_order + 1 WHERE slug IN ('pool', 'wellness', 'terrace', 'other');
INSERT INTO public.spaces (slug, name, icon_key, sort_order, is_active, in_home_carrousel)
VALUES ('garden-house', 'Garden house', 'garden_house', 9, true, false)
ON CONFLICT DO NOTHING;

INSERT INTO public.service_spaces (service_id, space_id)
SELECT c.id, s.id FROM public.categories c, public.spaces s
WHERE c.slug = 'shed-builder' AND c.category_type = 'Professional' AND s.slug = 'garden-house'
ON CONFLICT DO NOTHING;
-- Schuurenbouwers publiceren alleen onder Tuinhuis; de koppeling aan Tuin
-- uit 297 vervalt.
DELETE FROM public.service_spaces ss USING public.categories c, public.spaces s
WHERE c.id = ss.service_id AND s.id = ss.space_id AND c.slug = 'shed-builder' AND s.slug = 'garden';

-- De zeven projecten die het type droegen krijgen hun primaire object als
-- type. Estate Loevesteyn, Hoogwaardige Wellness en Poolhouse: villa.
-- Nest (i29, Hoge Veluwe): chalet. Floating Home (i29): huis. Garden
-- Pavilion (concept) en Sports Facility Breda (afgewezen): geen type.
UPDATE public.projects SET building_type = 'villa',
  project_type_category_id = (SELECT id FROM public.categories WHERE category_type = 'Project' AND slug = 'villa')
WHERE slug IN ('estate-loevesteyn', 'high-end-wellness', 'poolhouse');
UPDATE public.projects SET building_type = 'chalet',
  project_type_category_id = (SELECT id FROM public.categories WHERE category_type = 'Project' AND slug = 'chalet')
WHERE slug = 'nest';
UPDATE public.projects SET building_type = 'house', project_type_category_id = NULL WHERE slug = 'floating-home';
UPDATE public.projects SET building_type = NULL, project_type_category_id = NULL WHERE slug IN ('garden-pavilion', 'sports-facility-breda');
INSERT INTO public.project_categories (project_id, category_id, is_primary)
SELECT p.id, p.project_type_category_id, true FROM public.projects p
WHERE p.slug IN ('estate-loevesteyn', 'high-end-wellness', 'poolhouse', 'nest') AND p.project_type_category_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.project_categories pc WHERE pc.project_id = p.id AND pc.category_id = p.project_type_category_id);

-- De standaardfeature "Garden house" op die projecten wordt de zone
-- Tuinhuis, zodat de eigenaar er foto's op kan taggen.
UPDATE public.project_features f SET space_id = (SELECT id FROM public.spaces WHERE slug = 'garden-house')
WHERE f.space_id IS NULL AND lower(f.name) IN ('garden house', 'tuinhuis', 'poolhouse', 'garden pavilion');

-- Het gebouwtype zelf. project_categories volgt via cascade;
-- project_type_category_id is hierboven al omgezet.
DELETE FROM public.categories WHERE category_type = 'Project' AND slug = 'garden-house';
