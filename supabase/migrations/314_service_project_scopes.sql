-- 314: welke scopes een dienst ziet in het scopevak.
--
-- Tot nu toe zag elke dienst met publiceerstand 'project' alle drie de
-- scopes. Nu per dienst: een architect publiceert nieuwbouw en renovatie,
-- een interieurarchitect interieur design. Een bedrijf met beide diensten
-- ziet de vereniging. Leeg = alle drie (vangnet, zodat een nieuwe dienst
-- met stand 'project' niet zonder opties zit).
--
-- Daarnaast mag een architect een tuinhuis als ruimteproject publiceren:
-- de koppeling architect → tuinhuis in service_spaces. Die ruimtes tellen
-- voortaan voor elke publicerende dienst, niet alleen voor stand 'partial'
-- (lib/projects/publish-options.ts en het scopevak in de editor).

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS project_scopes text[] NOT NULL DEFAULT '{}'
  CHECK (project_scopes <@ ARRAY['new_build', 'renovation', 'interior_design']::text[]);

UPDATE public.categories SET project_scopes = ARRAY['new_build', 'renovation']
WHERE category_type = 'Professional' AND slug = 'architect';
UPDATE public.categories SET project_scopes = ARRAY['interior_design']
WHERE category_type = 'Professional' AND slug = 'interior-designer';

INSERT INTO public.service_spaces (service_id, space_id)
SELECT c.id, sp.id
FROM public.categories c, public.spaces sp
WHERE c.category_type = 'Professional' AND c.slug = 'architect' AND sp.slug = 'garden-house'
ON CONFLICT DO NOTHING;
