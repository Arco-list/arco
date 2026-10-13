-- Vier filterdimensies die nooit één keer zijn gebruikt.
--
-- ⚠ TOEGEPAST OP 13 OKTOBER 2026, MET DE HAND VIA DE SQL-EDITOR.
--   Daardoor staat deze migratie NIET in supabase_migrations.schema_migrations;
--   die geschiedenis eindigt op 282. Leg je de map naast de geschiedenis, dan
--   lijkt het alsof 283 nog moet draaien — dat is niet zo. Vandaar dat het
--   onderstaande in een DO-blok staat met een controle vooraf: op een database
--   waar hij al gedraaid is doet hij niets, op een verse database doet hij zijn
--   werk. Opnieuw aanbieden aan de migratietool is dus veilig, en dat is ook de
--   manier om de administratie alsnog gelijk te trekken.
--
-- Gemeten over 186 gepubliceerde projecten, vóór het opruimen:
--
--   taxonomy_type       opties   selecties
--   project_scope            3         186
--   project_style           15         185
--   location_feature        15           0
--   material_feature        17           0
--   size_range               4           0
--   budget_tier              4           0
--
-- Veertig optierijen waar nooit een project aan is gekoppeld, en FilterBar
-- rendert er geen van. Dat nul geen toeval is blijkt uit de importpijplijn:
-- die haalt geen vloeroppervlak, materialen of locatiekenmerken uit een bron,
-- dus er was ook nooit iets om te schrijven. Een filter is zijn enumwaarde pas
-- waard als iets hem vult.
--
-- Waarom toen: Postgres kent geen DROP VALUE op een enum, dus weghalen vraagt
-- een hertypering. ADD VALUE is daarentegen één statement. Met nul selecties
-- was dat het goedkoopste moment om te schrappen, en terugzetten — als de
-- import ooit wél oppervlakte kan extraheren — kost één regel.
--
-- De hertypering blijft binnen één tabel: alleen
-- project_taxonomy_options.taxonomy_type en vijf indexen op diezelfde tabel
-- gebruiken het type. Geen functies, geen andere kolommen, geen DEFAULT op de
-- kolom. ALTER COLUMN bouwt de indexen zelf opnieuw.
--
-- Draai dit NA 282 en NA de codewijziging die deze vier niet meer opvraagt.
-- Een .in() met een enumlabel dat niet meer bestaat is geen lege uitkomst maar
-- een queryfout.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
       AND t.typname = 'project_taxonomy_type'
       AND e.enumlabel IN ('location_feature', 'material_feature', 'size_range', 'budget_tier')
  ) THEN

    -- Verweesde selecties eerst. Bij de echte uitvoering waren dit er nul,
    -- maar de volgorde moet kloppen als dit ooit op een andere database draait.
    -- De ::text-cast is nodig omdat de labels na afloop niet meer bestaan.
    DELETE FROM public.project_taxonomy_selections s
     USING public.project_taxonomy_options o
     WHERE s.taxonomy_option_id = o.id
       AND o.taxonomy_type::text IN ('location_feature', 'material_feature', 'size_range', 'budget_tier');

    DELETE FROM public.project_taxonomy_options
     WHERE taxonomy_type::text IN ('location_feature', 'material_feature', 'size_range', 'budget_tier');

    -- EXECUTE omdat deze statements verwijzen naar een type dat pas tijdens
    -- dit blok ontstaat.
    EXECUTE $ddl$CREATE TYPE public.project_taxonomy_type_new AS ENUM ('project_scope', 'project_style')$ddl$;
    EXECUTE $ddl$ALTER TABLE public.project_taxonomy_options
                   ALTER COLUMN taxonomy_type TYPE public.project_taxonomy_type_new
                   USING taxonomy_type::text::public.project_taxonomy_type_new$ddl$;
    EXECUTE $ddl$DROP TYPE public.project_taxonomy_type$ddl$;
    EXECUTE $ddl$ALTER TYPE public.project_taxonomy_type_new RENAME TO project_taxonomy_type$ddl$;

  END IF;
END $$;
