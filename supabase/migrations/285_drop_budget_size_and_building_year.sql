-- Vijf lege kolommen die een hele keten aan objecten gijzelen.
--
--   budget_level   0 van 214    budget_min  0    budget_max  0
--   project_size   0 van 214    building_year  5 van 214
--
-- Arco toont gerealiseerd werk, geen opdrachten. Een budget hoort bij een
-- aanvraag, niet bij een gebouw dat er staat — vandaar dat in 214 projecten
-- nooit iemand er een heeft ingevuld. project_size is de kolomversie van de
-- size_range-taxonomie die in 283 is geschrapt om dezelfde reden: er is geen
-- bron die vloeroppervlak levert.
--
-- building_year is subtieler: de import schrijft het gevonden bouwjaar naar
-- PROJECT_YEAR, want dat is wat de "Jaar"-regel in de detailbalk leest, en zet
-- building_year expliciet op null. Het is dus een formulierveld in de
-- projecteditor dat niemand toont en dat een kolom dupliceert die wél getoond
-- wordt. De vijf gevulde rijen zijn van vóór die keuze.
--
-- Waarom dit een grote migratie is: alle vijf zitten in mv_project_summary én
-- in project_search_documents, budget_level staat bovendien in de signatuur van
-- search_projects, en de afgeleide budget_display wordt teruggegeven door
-- search_projects en door beide varianten van
-- get_user_saved_projects_with_summary. Droppen kan dus alleen door die keten
-- af te breken en in omgekeerde volgorde weer op te bouwen.
--
-- LET OP — dit is waar 091 en 093 in deze geschiedenis over gingen:
--   * de UNIEKE index op mv_project_summary moet terug, anders breekt
--     REFRESH MATERIALIZED VIEW CONCURRENTLY;
--   * rechten overleven een DROP niet. anon, authenticated en service_role
--     hebben expliciete grants op de view en de matview, en EXECUTE op de drie
--     functies. Zonder de GRANTs onderaan geeft de API "permission denied".
--
-- Draai dit samen met de codewijziging die budget_display niet meer leest
-- (contexts/saved-projects-context.tsx) en met een nieuwe types.ts.

-- ── 1. keten afbreken, van buiten naar binnen ────────────────────────────
DROP FUNCTION IF EXISTS public.search_projects(text, text, uuid, project_budget_level, text, text[], text[], boolean, integer, integer);
DROP FUNCTION IF EXISTS public.get_user_saved_projects_with_summary();
DROP FUNCTION IF EXISTS public.get_user_saved_projects_with_summary(uuid);
DROP VIEW IF EXISTS public.project_search_documents;
DROP MATERIALIZED VIEW IF EXISTS public.mv_project_summary;

-- ── 2. de kolommen en het enum dat alleen zij gebruikten ─────────────────
ALTER TABLE public.projects
  DROP COLUMN IF EXISTS budget_level,
  DROP COLUMN IF EXISTS budget_min,
  DROP COLUMN IF EXISTS budget_max,
  DROP COLUMN IF EXISTS project_size,
  DROP COLUMN IF EXISTS building_year;

-- Het enum hangt ook aan project_taxonomy_options.budget_level: 18 rijen,
-- 0 gevuld. Die kolom had alleen betekenis voor de budget_tier-opties die 283
-- heeft verwijderd, dus hij is nu per definitie dood. Zonder deze DROP faalt
-- de DROP TYPE hieronder.
ALTER TABLE public.project_taxonomy_options
  DROP COLUMN IF EXISTS budget_level;

DROP TYPE IF EXISTS public.project_budget_level;

-- ── 3. matview terug, identiek minus de vijf en budget_display ───────────
CREATE MATERIALIZED VIEW public.mv_project_summary AS
 SELECT p.id,
    p.title,
    p.description,
    p.translations,
    p.location,
    p.project_type,
    p.building_type,
    p.style_preferences,
    p.features,
    p.is_featured,
    p.likes_count,
    p.views_count,
    p.status,
    p.slug,
    p.project_year,
    prof.first_name AS client_first_name,
    prof.last_name AS client_last_name,
    prof.avatar_url AS client_avatar,
    pp.url AS primary_photo_url,
    pp.alt_text AS primary_photo_alt,
    cat.name AS primary_category,
    cat.slug AS primary_category_slug,
    cat.icon AS primary_category_icon,
    cat.color AS primary_category_color,
    COALESCE(photo_stats.photo_count, 0::bigint) AS photo_count,
    p.created_at,
    p.updated_at
   FROM projects p
     JOIN profiles prof ON p.client_id = prof.id
     LEFT JOIN project_photos pp ON p.id = pp.project_id AND pp.is_primary = true
     LEFT JOIN project_categories pc ON p.id = pc.project_id AND pc.is_primary = true
     LEFT JOIN categories cat ON pc.category_id = cat.id
     LEFT JOIN ( SELECT project_photos.project_id,
            count(*) AS photo_count
           FROM project_photos
          GROUP BY project_photos.project_id) photo_stats ON p.id = photo_stats.project_id
  WHERE p.status = 'published'::project_status
    AND prof.is_active = true
    AND NOT (EXISTS ( SELECT 1
           FROM project_professionals owner_pp
             JOIN companies owner_c ON owner_c.id = owner_pp.company_id
          WHERE owner_pp.project_id = p.id
            AND owner_pp.is_project_owner = true
            AND owner_c.status = 'added'::company_status));

-- De unieke index eerst: zonder deze is CONCURRENTLY niet mogelijk en valt
-- elke verversing terug op een exclusieve lock.
CREATE UNIQUE INDEX idx_mv_project_summary_id       ON public.mv_project_summary USING btree (id);
CREATE INDEX        idx_mv_project_summary_featured ON public.mv_project_summary USING btree (is_featured);
CREATE INDEX        idx_mv_project_summary_created  ON public.mv_project_summary USING btree (created_at);
CREATE INDEX        idx_mv_project_summary_likes    ON public.mv_project_summary USING btree (likes_count);
CREATE INDEX        idx_mv_project_summary_category ON public.mv_project_summary USING btree (primary_category);
CREATE INDEX        idx_mv_project_summary_location ON public.mv_project_summary USING btree (location);
CREATE INDEX        idx_mv_project_summary_type     ON public.mv_project_summary USING btree (project_type);
CREATE INDEX        idx_mv_project_summary_search   ON public.mv_project_summary
  USING gin (to_tsvector('simple'::regconfig,
    ((((COALESCE(title, ''::text) || ' '::text) || COALESCE(description, ''::text)) || ' '::text) || COALESCE(location, ''::text))));
-- idx_mv_project_summary_budget keert niet terug: die stond op budget_level.

-- ── 4. zoekdocumenten terug ──────────────────────────────────────────────
-- De search_vector verliest project_size, budget_display en budget_level.
-- Hier als concat_ws geschreven in plaats van de gegenereerde haakjessoep:
-- functioneel gelijk, want concat_ws slaat NULL over waar COALESCE er een
-- lege string van maakte, en beide leveren dezelfde tsvector.
CREATE VIEW public.project_search_documents AS
 SELECT doc.id,
    doc.title,
    doc.description,
    doc.translations,
    doc.location,
    doc.project_type,
    doc.building_type,
    doc.style_preferences,
    doc.features,
    doc.is_featured,
    doc.likes_count,
    doc.views_count,
    doc.status,
    doc.slug,
    doc.project_year,
    doc.client_first_name,
    doc.client_last_name,
    doc.client_avatar,
    doc.primary_photo_url,
    doc.primary_photo_alt,
    doc.primary_category,
    doc.primary_category_slug,
    doc.primary_category_icon,
    doc.primary_category_color,
    doc.photo_count,
    doc.created_at,
    doc.updated_at,
    doc.search_vector,
    doc.credited_count,
    row_number() OVER (
      PARTITION BY doc.is_featured, (COALESCE(doc.project_type, 'other'::text))
      ORDER BY doc.credited_count DESC, (COALESCE(doc.views_count, 0)) DESC, doc.created_at DESC
    )::integer AS scope_rotation,
    pr.address_city,
    pr.address_region
   FROM ( SELECT p.*,
            ( SELECT count(*)::integer
                FROM project_professionals pp
               WHERE pp.project_id = p.id
                 AND (pp.status = ANY (ARRAY['live_on_page'::professional_project_status,
                                             'listed'::professional_project_status]))) AS credited_count
           FROM ( SELECT mv.*,
                    to_tsvector('simple'::regconfig,
                      TRIM(BOTH ' ' FROM concat_ws(' ',
                        mv.title,
                        mv.slug,
                        mv.description,
                        mv.location,
                        mv.primary_category,
                        mv.primary_category_slug,
                        mv.project_type,
                        mv.building_type,
                        array_to_string(COALESCE(mv.style_preferences, ARRAY[]::text[]), ' '),
                        array_to_string(COALESCE(mv.features, ARRAY[]::text[]), ' ')
                      ))) AS search_vector
                   FROM mv_project_summary mv) p) doc
     LEFT JOIN projects pr ON pr.id = doc.id;

-- ── 5. functies terug, zonder budget ─────────────────────────────────────
CREATE FUNCTION public.search_projects(
  search_query        text    DEFAULT NULL,
  location_filter     text    DEFAULT NULL,
  category_filter     uuid    DEFAULT NULL,
  project_type_filter text    DEFAULT NULL,
  style_filters       text[]  DEFAULT NULL,
  feature_filters     text[]  DEFAULT NULL,
  featured_only       boolean DEFAULT false,
  limit_count         integer DEFAULT 20,
  offset_count        integer DEFAULT 0)
RETURNS TABLE(id uuid, title text, translations jsonb, location text, project_type text,
              primary_photo_url text, primary_category text, likes_count integer,
              is_featured boolean, slug text, created_at timestamp with time zone)
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT p.id, p.title, p.translations, p.location, p.project_type, p.primary_photo_url,
    p.primary_category, p.likes_count, p.is_featured, p.slug, p.created_at
  FROM public.mv_project_summary p
  WHERE (NOT featured_only OR p.is_featured = TRUE)
    AND (location_filter IS NULL OR p.location ILIKE '%' || location_filter || '%')
    AND (project_type_filter IS NULL OR p.project_type ILIKE '%' || project_type_filter || '%')
    AND (category_filter IS NULL OR p.id IN (SELECT pc.project_id FROM public.project_categories pc WHERE pc.category_id = category_filter))
    AND (style_filters IS NULL OR p.style_preferences && style_filters)
    AND (feature_filters IS NULL OR p.features && feature_filters)
    AND (search_query IS NULL OR (p.title ILIKE '%' || search_query || '%' OR p.description ILIKE '%' || search_query || '%' OR p.location ILIKE '%' || search_query || '%'))
  ORDER BY p.is_featured DESC, p.likes_count DESC, p.created_at DESC
  LIMIT limit_count OFFSET offset_count;
END;
$function$;

CREATE FUNCTION public.get_user_saved_projects_with_summary()
RETURNS TABLE(saved_at timestamp with time zone, id uuid, slug text, title text,
              translations jsonb, primary_photo_url text, primary_photo_alt text,
              location text, likes_count integer, created_at timestamp with time zone,
              updated_at timestamp with time zone, style_preferences text[], project_type text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    sp.created_at AS saved_at,
    mv.id, mv.slug, mv.title, mv.translations,
    mv.primary_photo_url, mv.primary_photo_alt, mv.location,
    mv.likes_count, mv.created_at, mv.updated_at,
    mv.style_preferences, mv.project_type
  FROM public.saved_projects sp
  INNER JOIN public.mv_project_summary mv ON sp.project_id = mv.id
  WHERE sp.user_id = v_user_id
  ORDER BY sp.created_at DESC;
END;
$function$;

CREATE FUNCTION public.get_user_saved_projects_with_summary(p_user_id uuid)
RETURNS TABLE(saved_at timestamp with time zone, id uuid, slug text, title text,
              primary_photo_url text, primary_photo_alt text, location text,
              likes_count integer, created_at timestamp with time zone,
              updated_at timestamp with time zone, style_preferences text[], project_type text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    sp.created_at AS saved_at,
    mv.id, mv.slug, mv.title,
    mv.primary_photo_url, mv.primary_photo_alt, mv.location,
    mv.likes_count, mv.created_at, mv.updated_at,
    mv.style_preferences, mv.project_type
  FROM saved_projects sp
  INNER JOIN mv_project_summary mv ON sp.project_id = mv.id
  WHERE sp.user_id = p_user_id
  ORDER BY sp.created_at DESC;
$function$;

-- ── 6. rechten terug — zonder dit geeft de API permission denied ─────────
GRANT ALL ON public.mv_project_summary       TO anon, authenticated, service_role;
GRANT ALL ON public.project_search_documents TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.search_projects(text, text, uuid, text, text[], text[], boolean, integer, integer) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_saved_projects_with_summary()     TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_saved_projects_with_summary(uuid) TO PUBLIC, anon, authenticated, service_role;
