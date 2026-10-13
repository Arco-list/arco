-- "building_type" betekende twee verschillende dingen, en dat wordt
-- gevaarlijk zodra er commerciële bouwtypen bijkomen.
--
-- projects.building_type is het BOUWTYPE: villa, apartment, farm.
-- De enumwaarde project_taxonomy_type.'building_type' is de SCOPE:
-- new-build, renovated, interior-designed. De code noemt dat laatste
-- overal al scope — ProjectScope, scopeLabel, SCOPE_LABELS,
-- SCOPE_HUB_DEFS, canonicalizeScope, HubKind "scope" — en
-- lib/project-translations.ts noemt de DB-kant letterlijk "the broken
-- DB-backed building_type taxonomy that actually held scope values".
-- Alleen de database droeg die naam nog.
--
-- Zonder deze hernoeming moet wie 'hotel' toevoegt kiezen tussen twee
-- dingen die hetzelfde heten, en de verkeerde keuze levert een optierij
-- op die nergens verschijnt. Dit is dus geen opruiming maar een
-- voorwaarde voor de commerciële uitbreiding.
--
-- Veilig voor de data: de 186 selecties in project_taxonomy_selections
-- wijzen op taxonomy_option_id, niet op de enumwaarde. RENAME VALUE
-- verandert het label op zijn plek en raakt geen rij.
--
-- Idempotent gemaakt omdat RENAME VALUE geen IF EXISTS kent.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
       AND t.typname = 'project_taxonomy_type'
       AND e.enumlabel = 'building_type'
  ) THEN
    ALTER TYPE public.project_taxonomy_type
      RENAME VALUE 'building_type' TO 'project_scope';
  END IF;
END $$;
