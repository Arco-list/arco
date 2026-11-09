-- 298: wellness als ruimte.
--
-- Sauna, stoomcabine, jacuzzi en home spa zijn een eigen, fotogenieke
-- categorie in het hogere segment die tot nu toe in Badkamer en Zwembad
-- verdween. De ruimte past één op één op de dienst Wellness en straks op
-- een productgroep. Zwembad blijft apart. Code: lib/spaces.ts,
-- lib/type-labels.ts (naam), lib/project-hubs.ts (hub /projects/wellness,
-- fotogated), components/filter-bar.tsx (filter), icoon 'wellness' in
-- lib/icons/project-features.ts.

UPDATE public.spaces SET sort_order = 11 WHERE slug = 'terrace';
UPDATE public.spaces SET sort_order = 12 WHERE slug = 'other';

INSERT INTO public.spaces (slug, name, icon_key, sort_order, is_active, in_home_carrousel)
VALUES ('wellness', 'Wellness', 'wellness', 10, true, false)
ON CONFLICT DO NOTHING;

-- De dienst Wellness publiceert deelprojecten onder de eigen ruimte; de
-- tijdelijke koppeling aan badkamer en zwembad (297) vervalt.
INSERT INTO public.service_spaces (service_id, space_id)
SELECT c.id, s.id FROM public.categories c, public.spaces s
WHERE c.slug = 'wellness' AND c.category_type = 'Professional' AND s.slug = 'wellness'
ON CONFLICT DO NOTHING;

DELETE FROM public.service_spaces ss USING public.categories c, public.spaces s
WHERE c.id = ss.service_id AND s.id = ss.space_id
  AND c.slug = 'wellness' AND s.slug IN ('bathroom', 'pool');

-- Exterieur en Overig blijven ruimtes voor foto's, maar zijn geen ruimte
-- waar een deelproject onder valt (zie Samenhang-tab).
DELETE FROM public.service_spaces ss USING public.spaces s
WHERE s.id = ss.space_id AND s.slug IN ('exterior', 'other');
