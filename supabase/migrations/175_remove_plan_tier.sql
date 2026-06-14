-- Retire plan tiers entirely.
--
-- Drops:
--   - companies.plan_tier, plan_expires_at, upgrade_eligible columns
--   - company_plan_tier enum
--   - mv_company_listings (was using the column; saved-companies path moves
--     to mv_professional_summary)
--   - The `plan_tier = 'plus'` filter inside get_public_company_photos —
--     listing visibility is now purely status-driven.
--
-- Rebuilds:
--   - mv_professional_summary minus the plan columns
--   - search_professionals, count_professionals, get_professional_location_facets
--   - get_user_saved_companies_with_summary against mv_professional_summary
--   - refresh_all_materialized_views without mv_company_listings
--   - update_company_services without the mv_company_listings refresh
--   - refresh helpers + triggers

-- ────────────────────────────────────────────────────────────────────────
-- Drop everything that references the plan columns. CASCADE on the MVs
-- takes their dependent functions (search_professionals, count_professionals,
-- get_professional_location_facets, refresh helpers, get_user_saved_companies_with_summary).
-- ────────────────────────────────────────────────────────────────────────

DROP MATERIALIZED VIEW IF EXISTS public.mv_professional_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_company_listings CASCADE;

-- Triggers that referenced now-dropped trigger functions.
DROP TRIGGER IF EXISTS refresh_mv_professional_summary_on_company_contact_change ON public.company_contacts;
DROP TRIGGER IF EXISTS refresh_mv_professional_summary_on_person_change ON public.persons;
DROP TRIGGER IF EXISTS refresh_mv_professional_summary_on_company_change ON public.companies;

-- RLS on company_photos used the plan_tier='plus' gate to hide non-plus
-- cover photos. Rebuild without the plan checks — visibility is just
-- "is_cover AND company.status='listed'" now.
DROP POLICY IF EXISTS company_photos_public_select ON public.company_photos;
CREATE POLICY company_photos_public_select ON public.company_photos
FOR SELECT TO public
USING (
  is_cover = true
  AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_photos.company_id
      AND c.status = 'listed'::company_status
  )
);

-- get_public_company_photos pinned the plan_tier='plus' visibility gate.
-- Rebuild without that filter — listing visibility is just status now.
CREATE OR REPLACE FUNCTION public.get_public_company_photos(p_company_id uuid)
RETURNS TABLE(id uuid, url text, alt_text text, is_cover boolean, order_index integer, created_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  SELECT cp.id, cp.url, cp.alt_text, cp.is_cover, cp.order_index, cp.created_at
  FROM public.company_photos AS cp
  JOIN public.companies AS c ON c.id = cp.company_id
  WHERE cp.company_id = p_company_id
    AND c.status = 'listed'::company_status
  ORDER BY cp.is_cover DESC, cp.order_index ASC, cp.created_at ASC
  LIMIT 30;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- Drop the columns + enum.
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.companies
  DROP COLUMN plan_tier,
  DROP COLUMN plan_expires_at,
  DROP COLUMN upgrade_eligible;

DROP TYPE public.company_plan_tier;

-- ────────────────────────────────────────────────────────────────────────
-- Rebuild mv_professional_summary (same as migration 174, minus
-- company_plan_tier and company_plan_expires_at columns).
-- ────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW public.mv_professional_summary AS
SELECT
  c.id AS id,
  c.id AS company_id,
  c.id AS company_id_full,

  pe.auth_user_id AS user_id,
  pe.first_name,
  pe.last_name,

  c.name AS company_name,
  c.slug AS company_slug,
  c.logo_url AS company_logo,
  c.city AS company_city,
  c.state_region AS company_state_region,
  c.country AS company_country,
  c.domain AS company_domain,
  c.status AS company_status,
  c.is_featured AS company_is_featured,
  c.latitude AS company_latitude,
  c.longitude AS company_longitude,
  c.audience AS company_audience,
  c.is_verified,
  c.created_at,
  c.updated_at,

  primary_cat.name    AS primary_service_name,
  primary_cat.name_nl AS primary_service_name_nl,

  ( SELECT array_agg(DISTINCT cat.name ORDER BY cat.name)
    FROM ( SELECT unnest(c.services_offered) AS service_id
           UNION
           SELECT c.primary_service_id::text WHERE c.primary_service_id IS NOT NULL
         ) all_services
    JOIN public.categories cat ON cat.id::text = all_services.service_id
    WHERE cat.name IS NOT NULL
  ) AS services_offered,

  lower(trim(both ' ' from coalesce(c.country, '')))      AS searchable_country,
  lower(trim(both ' ' from coalesce(c.state_region, ''))) AS searchable_state_region,
  lower(trim(both ' ' from coalesce(c.city, '')))         AS searchable_city,

  COALESCE(primary_cat.name,
           ( SELECT cat_s.name
             FROM unnest(c.services_offered) WITH ORDINALITY t(service_id, idx)
             JOIN public.categories cat_s ON cat_s.id::text = t.service_id
             WHERE cat_s.parent_id IS NOT NULL
             ORDER BY t.idx LIMIT 1 )) AS primary_specialty,
  COALESCE(primary_cat.slug,
           ( SELECT cat_s.slug
             FROM unnest(c.services_offered) WITH ORDINALITY t(service_id, idx)
             JOIN public.categories cat_s ON cat_s.id::text = t.service_id
             WHERE cat_s.parent_id IS NOT NULL
             ORDER BY t.idx LIMIT 1 )) AS primary_specialty_slug,

  ( SELECT array_agg(DISTINCT all_ids.service_uuid)
    FROM ( SELECT cat_s.id AS service_uuid
           FROM unnest(c.services_offered) t(service_id)
           JOIN public.categories cat_s ON cat_s.id::text = t.service_id
           UNION
           SELECT c.primary_service_id WHERE c.primary_service_id IS NOT NULL
         ) all_ids
  ) AS specialty_ids,

  ( SELECT array_agg(DISTINCT sub.parent_uuid)
    FROM ( SELECT cat_s.parent_id AS parent_uuid
           FROM unnest(c.services_offered) t(service_id)
           JOIN public.categories cat_s ON cat_s.id::text = t.service_id
           WHERE cat_s.parent_id IS NOT NULL
           UNION
           SELECT cat_s.id
           FROM unnest(c.services_offered) t(service_id)
           JOIN public.categories cat_s ON cat_s.id::text = t.service_id
           WHERE cat_s.parent_id IS NULL
           UNION
           SELECT cat_p.parent_id
           FROM public.categories cat_p
           WHERE cat_p.id = c.primary_service_id AND cat_p.parent_id IS NOT NULL
           UNION
           SELECT cat_p.id
           FROM public.categories cat_p
           WHERE cat_p.id = c.primary_service_id AND cat_p.parent_id IS NULL
         ) sub
  ) AS specialty_parent_ids,

  COALESCE(c.hero_photo_url,
           ( SELECT cp.url FROM public.company_photos cp
             WHERE cp.company_id = c.id AND cp.is_cover = true
             ORDER BY cp.order_index LIMIT 1 ),
           ( SELECT cp.url FROM public.company_photos cp
             WHERE cp.company_id = c.id
             ORDER BY cp.order_index LIMIT 1 ),
           ( SELECT pp.url FROM public.project_photos pp
             JOIN public.project_professionals prp ON pp.project_id = prp.project_id
             WHERE prp.company_id = c.id
             ORDER BY pp.is_primary DESC NULLS LAST, pp.order_index LIMIT 1 )
  ) AS cover_photo_url

FROM public.companies c
LEFT JOIN public.company_contacts cc
  ON cc.company_id = c.id AND cc.role = 'owner'
LEFT JOIN public.persons pe
  ON pe.id = cc.person_id
LEFT JOIN public.categories primary_cat
  ON primary_cat.id = c.primary_service_id
WHERE c.status IN ('listed', 'unlisted', 'prospected')
  AND c.audience = 'homeowner';

CREATE UNIQUE INDEX idx_mv_professional_summary_id
  ON public.mv_professional_summary (id);
CREATE INDEX idx_mv_professional_summary_company_status
  ON public.mv_professional_summary (company_status);
CREATE INDEX idx_mv_professional_summary_searchable_city
  ON public.mv_professional_summary (searchable_city);

-- ────────────────────────────────────────────────────────────────────────
-- Refresh helpers + triggers.
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.refresh_mv_professional_summary()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.mv_professional_summary;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_professional_summary()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.mv_professional_summary;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_mv_professional_summary()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.refresh_mv_professional_summary();
  RETURN NULL;
END;
$$;

CREATE TRIGGER refresh_mv_professional_summary_on_company_contact_change
AFTER INSERT OR UPDATE OR DELETE ON public.company_contacts
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_mv_professional_summary();

CREATE TRIGGER refresh_mv_professional_summary_on_person_change
AFTER INSERT OR UPDATE OR DELETE ON public.persons
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_mv_professional_summary();

CREATE TRIGGER refresh_mv_professional_summary_on_company_change
AFTER INSERT OR UPDATE OR DELETE ON public.companies
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_mv_professional_summary();

-- mv_company_listings was rebuilt by refresh_all_materialized_views; that
-- function needs its first REFRESH call removed.
CREATE OR REPLACE FUNCTION public.refresh_all_materialized_views()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_professional_summary;
  REFRESH MATERIALIZED VIEW public.mv_project_summary;
END;
$$;

-- update_company_services also refreshed mv_company_listings — drop that line.
CREATE OR REPLACE FUNCTION public.update_company_services(
  p_company_id uuid,
  p_primary_service_id uuid,
  p_services_offered text[],
  p_languages text[],
  p_certificates text[]
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_has_access boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_id = v_user_id
    UNION ALL
    SELECT 1 FROM public.company_members
      WHERE company_id = p_company_id AND user_id = v_user_id AND status = 'active'
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Access denied: You do not have access to this company';
  END IF;

  UPDATE public.companies
  SET primary_service_id = p_primary_service_id,
      services_offered = p_services_offered,
      languages = p_languages,
      certificates = p_certificates,
      updated_at = NOW()
  WHERE id = p_company_id;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_professional_summary;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- search_professionals + count_professionals (no shape change, just
-- recreated because CASCADE dropped them).
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_professionals(
  search_query text DEFAULT NULL,
  country_filter text DEFAULT NULL,
  state_filter text DEFAULT NULL,
  city_filters text[] DEFAULT NULL,
  category_filters uuid[] DEFAULT NULL,
  service_filters uuid[] DEFAULT NULL,
  max_hourly_rate numeric DEFAULT NULL,
  verified_only boolean DEFAULT false,
  limit_count integer DEFAULT 20,
  offset_count integer DEFAULT 0,
  sort_by text DEFAULT 'most_relevant'
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  first_name text,
  last_name text,
  company_id uuid,
  company_name text,
  company_slug text,
  company_logo text,
  company_domain text,
  company_city text,
  company_state_region text,
  company_country text,
  company_latitude double precision,
  company_longitude double precision,
  primary_specialty text,
  primary_service_name text,
  services_offered text[],
  is_verified boolean,
  specialty_ids uuid[],
  specialty_parent_ids uuid[],
  cover_photo_url text,
  credited_sum integer,
  views_count integer,
  is_featured boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH project_credits AS (
    SELECT project_id, count(*)::int AS credited
    FROM public.project_professionals
    WHERE status IN ('live_on_page', 'listed')
    GROUP BY project_id
  ),
  company_credits AS (
    SELECT pp.company_id, COALESCE(SUM(pc.credited), 0)::int AS credited_sum
    FROM public.project_professionals pp
    LEFT JOIN project_credits pc ON pc.project_id = pp.project_id
    WHERE pp.status IN ('live_on_page', 'listed') AND pp.company_id IS NOT NULL
    GROUP BY pp.company_id
  )
  SELECT
    p.id, p.user_id, p.first_name, p.last_name,
    p.company_id,
    p.company_name, p.company_slug, p.company_logo, p.company_domain,
    p.company_city, p.company_state_region, p.company_country,
    p.company_latitude, p.company_longitude,
    p.primary_specialty, p.primary_service_name, p.services_offered,
    p.is_verified,
    p.specialty_ids, p.specialty_parent_ids, p.cover_photo_url,
    COALESCE(cc.credited_sum, 0)::int AS credited_sum,
    COALESCE(c.views_count, 0)::int AS views_count,
    COALESCE(c.is_featured, FALSE) AS is_featured
  FROM public.mv_professional_summary p
  LEFT JOIN public.companies c ON c.id = p.company_id
  LEFT JOIN company_credits cc ON cc.company_id = p.company_id
  WHERE
    p.company_status IN ('listed', 'prospected')
    AND (NOT verified_only OR p.is_verified = TRUE)
    AND (search_query IS NULL OR (
      p.first_name ILIKE '%' || search_query || '%'
      OR p.last_name ILIKE '%' || search_query || '%'
      OR p.primary_specialty ILIKE '%' || search_query || '%'
      OR p.primary_service_name ILIKE '%' || search_query || '%'
      OR p.primary_service_name_nl ILIKE '%' || search_query || '%'
      OR p.company_name ILIKE '%' || search_query || '%'
      OR p.company_city ILIKE '%' || search_query || '%'
      OR p.company_state_region ILIKE '%' || search_query || '%'
      OR (p.services_offered IS NOT NULL AND EXISTS (
        SELECT 1 FROM unnest(p.services_offered) service
        WHERE service ILIKE '%' || search_query || '%'))))
    AND (country_filter IS NULL OR p.searchable_country = lower(trim(country_filter)))
    AND (state_filter IS NULL OR p.searchable_state_region = lower(trim(state_filter)))
    AND (city_filters IS NULL OR array_length(city_filters, 1) IS NULL
         OR p.searchable_city = ANY(SELECT lower(trim(cf)) FROM unnest(city_filters) cf))
    AND (category_filters IS NULL OR array_length(category_filters, 1) IS NULL
         OR p.specialty_parent_ids && category_filters)
    AND (service_filters IS NULL OR array_length(service_filters, 1) IS NULL
         OR p.specialty_ids && service_filters)
  ORDER BY
    (CASE WHEN sort_by = 'featured' AND COALESCE(c.is_featured, FALSE) THEN 0 ELSE 1 END),
    (CASE WHEN sort_by IN ('most_relevant', 'featured') THEN -COALESCE(cc.credited_sum, 0) ELSE 0 END),
    (CASE WHEN sort_by = 'popular' THEN -COALESCE(c.views_count, 0) ELSE 0 END),
    p.created_at DESC
  LIMIT limit_count OFFSET offset_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_professionals(
  search_query text DEFAULT NULL,
  country_filter text DEFAULT NULL,
  state_filter text DEFAULT NULL,
  city_filters text[] DEFAULT NULL,
  category_filters uuid[] DEFAULT NULL,
  service_filters uuid[] DEFAULT NULL,
  max_hourly_rate numeric DEFAULT NULL,
  verified_only boolean DEFAULT false
)
RETURNS bigint
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result bigint;
BEGIN
  SELECT count(*) INTO result
  FROM public.mv_professional_summary p
  WHERE
    p.company_status IN ('listed', 'prospected')
    AND (NOT verified_only OR p.is_verified = TRUE)
    AND (search_query IS NULL OR (
      p.first_name ILIKE '%' || search_query || '%'
      OR p.last_name ILIKE '%' || search_query || '%'
      OR p.primary_specialty ILIKE '%' || search_query || '%'
      OR p.primary_service_name ILIKE '%' || search_query || '%'
      OR p.primary_service_name_nl ILIKE '%' || search_query || '%'
      OR p.company_name ILIKE '%' || search_query || '%'
      OR p.company_city ILIKE '%' || search_query || '%'
      OR p.company_state_region ILIKE '%' || search_query || '%'
      OR (p.services_offered IS NOT NULL AND EXISTS (
        SELECT 1 FROM unnest(p.services_offered) service
        WHERE service ILIKE '%' || search_query || '%'))))
    AND (country_filter IS NULL OR p.searchable_country = lower(trim(country_filter)))
    AND (state_filter IS NULL OR p.searchable_state_region = lower(trim(state_filter)))
    AND (city_filters IS NULL OR array_length(city_filters, 1) IS NULL
         OR p.searchable_city = ANY(SELECT lower(trim(cf)) FROM unnest(city_filters) cf))
    AND (category_filters IS NULL OR array_length(category_filters, 1) IS NULL
         OR p.specialty_parent_ids && category_filters)
    AND (service_filters IS NULL OR array_length(service_filters, 1) IS NULL
         OR p.specialty_ids && service_filters);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_professional_location_facets()
RETURNS TABLE(country text, state_region text, city text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.company_country, p.company_state_region, p.company_city
  FROM public.mv_professional_summary p
  WHERE p.company_status IN ('listed', 'prospected')
  ORDER BY p.company_country, p.company_state_region, p.company_city;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_professionals(text, text, text, text[], uuid[], uuid[], numeric, boolean, integer, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_professionals(text, text, text, text[], uuid[], uuid[], numeric, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_professional_location_facets() TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- get_user_saved_companies_with_summary — was dropped via CASCADE on
-- mv_company_listings. Rebuild it against mv_professional_summary (which
-- carries the same shape needed by the UI).
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_saved_companies_with_summary()
RETURNS TABLE (
  saved_at timestamp with time zone,
  professional_id uuid,
  company_id uuid,
  company_name text,
  company_slug text,
  company_logo text,
  company_domain text,
  company_city text,
  company_country text,
  company_state_region text,
  title text,
  first_name text,
  last_name text,
  primary_specialty text,
  primary_service_name text,
  services_offered text[],
  user_location text,
  is_verified boolean,
  cover_url text,
  logo_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    sc.created_at AS saved_at,
    p.id          AS professional_id,
    p.company_id,
    p.company_name,
    p.company_slug,
    p.company_logo,
    p.company_domain,
    p.company_city,
    p.company_country,
    p.company_state_region,
    NULL::text    AS title,
    p.first_name,
    p.last_name,
    p.primary_specialty,
    p.primary_service_name,
    p.services_offered,
    NULL::text    AS user_location,
    p.is_verified,
    p.cover_photo_url AS cover_url,
    p.company_logo    AS logo_url
  FROM public.saved_companies sc
  JOIN public.mv_professional_summary p ON p.id = sc.company_id
  WHERE sc.user_id = auth.uid()
  ORDER BY sc.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_saved_companies_with_summary() TO authenticated;
