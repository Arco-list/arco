-- 313: Terras is geen ruimteproject.
--
-- Een terras is zelden een losse opdracht: het hoort bij een tuinontwerp,
-- en een aparte keuze "Terras" naast "Tuin" in het scopevak verdeelt
-- hetzelfde werk over twee hubs. De koppeling tuinontwerper → terras
-- verdwijnt daarom; de scope-opties van een tuinontwerper zijn dan alleen
-- Tuin. Terras blijft een ruimte voor fototags en het ruimtefilter.
-- Geen enkel project had terras als primaire ruimte (gecontroleerd
-- 2026-11-18).

DELETE FROM public.service_spaces ss
USING public.categories c, public.spaces sp
WHERE ss.service_id = c.id
  AND ss.space_id = sp.id
  AND c.slug = 'garden-designer'
  AND sp.slug = 'terrace';
