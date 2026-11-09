-- 300: penthouse is geen gebouwtype meer.
--
-- Inactief, nul projecten, nul verwijzingen. Een penthouse is een
-- appartement; dat type dekt het. Code: lib/project-translations.ts,
-- lib/type-labels.ts, lib/project-details.ts.
--
-- Hier ook de nog openstaande verwijdering van het type Tuinhuis (299):
-- het is een ruimte onder Deelprojecten, geen gebouwtype.
-- De standaardfeature van een project ("Building", "Garden house") wijst
-- naar het type; project_features.category_id heeft geen cascade. Eerst
-- omhangen naar het huidige type van het project (null als dat er niet is).
UPDATE public.project_features f
SET category_id = p.project_type_category_id
FROM public.projects p, public.categories c
WHERE p.id = f.project_id AND c.id = f.category_id
  AND c.category_type = 'Project' AND c.slug IN ('garden-house', 'penthouse');

DELETE FROM public.categories WHERE category_type = 'Project' AND slug IN ('penthouse', 'garden-house');
