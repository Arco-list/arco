-- Fully remove the reviews + company_ratings feature.
--
-- Drops the source tables, rebuilds the three dependent views without
-- rating columns, rewrites the search RPC + saved-companies/professionals
-- RPCs to drop display_rating / total_reviews / min_rating, and drops
-- the legacy rating trigger functions and the unused
-- search_professionals_optimized helper.
--
-- The new view/function shapes are NOT backwards-compatible with any
-- caller that still selects display_rating / total_reviews / etc. —
-- the admin/professionals page is the only such caller and is updated
-- in the same PR.

-- ────────────────────────────────────────────────────────────────────────
-- Phase 1: drop dependents in dependency order
-- ────────────────────────────────────────────────────────────────────────

-- Trigger on reviews -> update_company_ratings (auto-dropped with table)
-- Trigger on company_ratings -> mv refresh (auto-dropped with table)
-- Trigger on professionals -> handle_new_professional (drop explicitly,
-- function only existed to seed a company_ratings row)
DROP TRIGGER IF EXISTS on_professional_created ON public.professionals;

-- Materialized views + regular view that SELECT cr.*
-- CASCADE picks up the search_professionals function, which we rebuild.
DROP MATERIALIZED VIEW IF EXISTS public.mv_professional_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_company_listings CASCADE;
DROP VIEW IF EXISTS public.company_metrics CASCADE;

-- Source tables (CASCADE clears RLS policies + remaining FK constraints).
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.company_ratings CASCADE;

-- Dead functions.
DROP FUNCTION IF EXISTS public.update_company_ratings() CASCADE;
DROP FUNCTION IF EXISTS public.update_professional_ratings() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_professional() CASCADE;
-- Legacy search helper — not called anywhere in app code.
DROP FUNCTION IF EXISTS public.search_professionals_optimized(text, text, uuid, boolean, boolean, numeric, text, integer, integer) CASCADE;

-- These four functions get rebuilt with new return-type shapes (rating
-- columns removed), and PG won't change RETURNS TABLE via CREATE OR
-- REPLACE — drop first.
DROP FUNCTION IF EXISTS public.search_professionals(text, text, text, text[], uuid[], uuid[], numeric, numeric, boolean, integer, integer, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_saved_companies_with_summary() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_saved_professionals_with_summary() CASCADE;
DROP FUNCTION IF EXISTS public.get_platform_stats() CASCADE;

-- ────────────────────────────────────────────────────────────────────────
-- Phase 2: rebuild materialized views (no rating columns)
-- ────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW public.mv_company_listings AS
SELECT
  c.id,
  c.slug,
  c.name,
  c.description,
  c.logo_url,
  c.city,
  c.state_region,
  c.country,
  c.domain,
  c.status,
  c.plan_tier,
  c.plan_expires_at,
  c.is_featured,
  (
    SELECT array_agg(cat.name ORDER BY t.idx)
    FROM unnest(c.services_offered) WITH ORDINALITY t(service_id, idx)
    LEFT JOIN categories cat ON cat.id::text = t.service_id
    WHERE cat.name IS NOT NULL
  ) AS services_offered,
  c.languages,
  c.team_size_min,
  c.team_size_max,
  c.founded_year,
  c.created_at,
  c.updated_at,
  first_prof.title AS professional_title,
  first_prof.first_name,
  first_prof.last_name,
  first_prof.avatar_url,
  first_prof.location AS user_location,
  (EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.company_id = c.id AND p.is_available = true
  )) AS has_available_professionals,
  (EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.company_id = c.id AND p.is_verified = true
  )) AS is_verified,
  lower(trim(both ' ' from COALESCE(c.country, ''))) AS searchable_country,
  lower(trim(both ' ' from COALESCE(c.state_region, ''))) AS searchable_state_region,
  lower(trim(both ' ' from COALESCE(c.city, ''))) AS searchable_city,
  c.primary_service_id AS primary_service,
  (
    SELECT array_agg(DISTINCT ps.category_id)
    FROM professionals p
    JOIN professional_specialties ps ON p.id = ps.professional_id
    WHERE p.company_id = c.id
  ) AS specialty_ids,
  (
    SELECT array_agg(DISTINCT cat.parent_id)
    FROM professionals p
    JOIN professional_specialties ps ON p.id = ps.professional_id
    JOIN categories cat ON ps.category_id = cat.id
    WHERE p.company_id = c.id AND cat.parent_id IS NOT NULL
  ) AS specialty_parent_ids,
  (
    SELECT COALESCE(
      (SELECT company_photos.url
       FROM company_photos
       WHERE company_photos.company_id = c.id AND company_photos.is_cover = true
       ORDER BY company_photos.order_index
       LIMIT 1),
      (SELECT company_photos.url
       FROM company_photos
       WHERE company_photos.company_id = c.id
       ORDER BY company_photos.order_index
       LIMIT 1)
    )
  ) AS cover_photo_url,
  (
    SELECT cat.name FROM categories cat
    WHERE cat.id = c.primary_service_id
    LIMIT 1
  ) AS primary_service_name
FROM companies c
LEFT JOIN LATERAL (
  SELECT p.title, prof.first_name, prof.last_name, prof.avatar_url, prof.location
  FROM professionals p
  JOIN profiles prof ON p.user_id = prof.id
  WHERE p.company_id = c.id AND p.is_available = true
  ORDER BY p.created_at
  LIMIT 1
) first_prof ON true
WHERE c.status = 'listed'::company_status;

CREATE UNIQUE INDEX idx_mv_company_listings_id ON public.mv_company_listings(id);

CREATE MATERIALIZED VIEW public.mv_professional_summary AS
SELECT
  p.id,
  p.user_id,
  p.company_id,
  COALESCE(p.title, c.name) AS title,
  COALESCE(p.bio, c.description) AS bio,
  COALESCE(p.is_verified, c.is_verified, false) AS is_verified,
  COALESCE(p.is_available, true) AS is_available,
  p.years_experience,
  p.hourly_rate_min,
  p.hourly_rate_max,
  p.portfolio_url,
  p.languages_spoken,
  (
    SELECT array_agg(DISTINCT cat.name ORDER BY cat.name)
    FROM (
      SELECT unnest(c.services_offered) AS service_id
      UNION
      SELECT c.primary_service_id::text WHERE c.primary_service_id IS NOT NULL
    ) all_services
    JOIN categories cat ON cat.id::text = all_services.service_id
    WHERE cat.name IS NOT NULL
  ) AS services_offered,
  COALESCE(p.created_at, c.created_at) AS created_at,
  COALESCE(p.updated_at, c.updated_at) AS updated_at,
  c.id AS company_id_full,
  c.name AS company_name,
  c.slug AS company_slug,
  c.logo_url AS company_logo,
  c.city AS company_city,
  c.state_region AS company_state_region,
  c.country AS company_country,
  c.domain AS company_domain,
  c.status AS company_status,
  c.plan_tier AS company_plan_tier,
  c.plan_expires_at AS company_plan_expires_at,
  c.is_featured AS company_is_featured,
  c.latitude AS company_latitude,
  c.longitude AS company_longitude,
  c.audience AS company_audience,
  primary_cat.name AS primary_service_name,
  primary_cat.name_nl AS primary_service_name_nl,
  prof.first_name,
  prof.last_name,
  prof.avatar_url,
  prof.location AS user_location,
  CASE
    WHEN p.hourly_rate_min IS NOT NULL AND p.hourly_rate_max IS NOT NULL
      THEN '€' || p.hourly_rate_min || ' - €' || p.hourly_rate_max || '/hr'
    WHEN p.hourly_rate_min IS NOT NULL
      THEN '€' || p.hourly_rate_min || '/hr'
    WHEN p.hourly_rate_max IS NOT NULL
      THEN '€' || p.hourly_rate_max || '/hr'
    ELSE NULL
  END AS hourly_rate_display,
  lower(trim(both ' ' from COALESCE(c.country, ''))) AS searchable_country,
  lower(trim(both ' ' from COALESCE(c.state_region, ''))) AS searchable_state_region,
  lower(trim(both ' ' from COALESCE(c.city, ''))) AS searchable_city,
  COALESCE(primary_cat.name, (
    SELECT cat_s.name
    FROM unnest(c.services_offered) WITH ORDINALITY t(service_id, idx)
    JOIN categories cat_s ON cat_s.id::text = t.service_id
    WHERE cat_s.parent_id IS NOT NULL
    ORDER BY t.idx
    LIMIT 1
  )) AS primary_specialty,
  COALESCE(primary_cat.slug, (
    SELECT cat_s.slug
    FROM unnest(c.services_offered) WITH ORDINALITY t(service_id, idx)
    JOIN categories cat_s ON cat_s.id::text = t.service_id
    WHERE cat_s.parent_id IS NOT NULL
    ORDER BY t.idx
    LIMIT 1
  )) AS primary_specialty_slug,
  (
    SELECT array_agg(DISTINCT all_ids.service_uuid)
    FROM (
      SELECT cat_s.id AS service_uuid
      FROM unnest(c.services_offered) t(service_id)
      JOIN categories cat_s ON cat_s.id::text = t.service_id
      UNION
      SELECT c.primary_service_id
      WHERE c.primary_service_id IS NOT NULL
    ) all_ids
  ) AS specialty_ids,
  (
    SELECT array_agg(DISTINCT sub.parent_uuid)
    FROM (
      SELECT cat_s.parent_id AS parent_uuid
      FROM unnest(c.services_offered) t(service_id)
      JOIN categories cat_s ON cat_s.id::text = t.service_id
      WHERE cat_s.parent_id IS NOT NULL
      UNION
      SELECT cat_s.id
      FROM unnest(c.services_offered) t(service_id)
      JOIN categories cat_s ON cat_s.id::text = t.service_id
      WHERE cat_s.parent_id IS NULL
      UNION
      SELECT cat_p.parent_id
      FROM categories cat_p
      WHERE cat_p.id = c.primary_service_id AND cat_p.parent_id IS NOT NULL
      UNION
      SELECT cat_p.id
      FROM categories cat_p
      WHERE cat_p.id = c.primary_service_id AND cat_p.parent_id IS NULL
    ) sub
  ) AS specialty_parent_ids,
  COALESCE(c.hero_photo_url, (
    SELECT cp.url FROM company_photos cp
    WHERE cp.company_id = c.id AND cp.is_cover = true
    ORDER BY cp.order_index LIMIT 1
  ), (
    SELECT cp.url FROM company_photos cp
    WHERE cp.company_id = c.id
    ORDER BY cp.order_index LIMIT 1
  ), (
    SELECT pp.url FROM project_photos pp
    JOIN project_professionals prp ON pp.project_id = prp.project_id
    WHERE prp.company_id = c.id
    ORDER BY pp.is_primary DESC NULLS LAST, pp.order_index
    LIMIT 1
  )) AS cover_photo_url
FROM companies c
LEFT JOIN professionals p ON p.company_id = c.id
LEFT JOIN categories primary_cat ON c.primary_service_id = primary_cat.id
LEFT JOIN profiles prof ON p.user_id = prof.id
WHERE c.status = ANY (ARRAY['listed'::company_status, 'unlisted'::company_status, 'prospected'::company_status])
  AND c.audience = 'homeowner'::text
GROUP BY
  p.id, p.user_id, p.company_id, p.title, p.bio, p.is_verified, p.is_available,
  p.years_experience, p.hourly_rate_min, p.hourly_rate_max, p.portfolio_url,
  p.languages_spoken, p.created_at, p.updated_at, c.id, c.name, c.slug,
  c.logo_url, c.city, c.state_region, c.country, c.domain, c.status,
  c.plan_tier, c.plan_expires_at, c.is_featured, c.services_offered,
  c.hero_photo_url, c.primary_service_id, c.latitude, c.longitude,
  c.description, c.is_verified, c.created_at, c.updated_at, c.audience,
  primary_cat.name, primary_cat.name_nl, primary_cat.slug,
  prof.first_name, prof.last_name, prof.avatar_url, prof.location;

CREATE UNIQUE INDEX idx_mv_professional_summary_id ON public.mv_professional_summary(id);

-- ────────────────────────────────────────────────────────────────────────
-- Phase 3: rebuild company_metrics (no rating columns)
-- ────────────────────────────────────────────────────────────────────────

CREATE VIEW public.company_metrics AS
WITH professional_counts AS (
  SELECT company_id, count(*)::integer AS professional_count
  FROM professionals
  WHERE company_id IS NOT NULL
  GROUP BY company_id
),
project_counts AS (
  SELECT p.company_id, count(DISTINCT pp.project_id)::integer AS projects_linked
  FROM professionals p
  JOIN project_professionals pp ON pp.professional_id = p.id
  WHERE p.company_id IS NOT NULL
  GROUP BY p.company_id
)
SELECT
  c.id AS company_id,
  COALESCE(pc.professional_count, 0) AS professional_count,
  COALESCE(prc.projects_linked, 0) AS projects_linked
FROM companies c
LEFT JOIN professional_counts pc ON pc.company_id = c.id
LEFT JOIN project_counts prc ON prc.company_id = c.id;

-- ────────────────────────────────────────────────────────────────────────
-- Phase 4: rebuild search_professionals (drop min_rating, rating cols)
-- ────────────────────────────────────────────────────────────────────────

CREATE FUNCTION public.search_professionals(
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
RETURNS TABLE(
  id uuid, user_id uuid, first_name text, last_name text, avatar_url text,
  user_location text, title text, company_id uuid, company_name text,
  company_slug text, company_logo text, company_domain text, company_city text,
  company_state_region text, company_country text,
  company_latitude double precision, company_longitude double precision,
  primary_specialty text, primary_service_name text, services_offered text[],
  hourly_rate_display text, is_verified boolean,
  specialty_ids uuid[], specialty_parent_ids uuid[], cover_photo_url text,
  credited_sum integer, views_count integer, is_featured boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH
  project_credits AS (
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
    p.id, p.user_id, p.first_name, p.last_name, p.avatar_url, p.user_location, p.title,
    COALESCE(p.company_id, p.company_id_full) AS company_id,
    p.company_name, p.company_slug, p.company_logo, p.company_domain, p.company_city,
    p.company_state_region, p.company_country, p.company_latitude, p.company_longitude,
    p.primary_specialty, p.primary_service_name, p.services_offered,
    p.hourly_rate_display, p.is_verified,
    p.specialty_ids, p.specialty_parent_ids, p.cover_photo_url,
    COALESCE(cc.credited_sum, 0)::int AS credited_sum,
    COALESCE(c.views_count, 0)::int AS views_count,
    COALESCE(c.is_featured, FALSE) AS is_featured
  FROM public.mv_professional_summary p
  LEFT JOIN public.companies c ON c.id = COALESCE(p.company_id, p.company_id_full)
  LEFT JOIN company_credits cc ON cc.company_id = COALESCE(p.company_id, p.company_id_full)
  WHERE
    p.company_status IN ('listed', 'prospected')
    AND (NOT verified_only OR p.is_verified = TRUE)
    AND (
      search_query IS NULL OR (
        p.title ILIKE '%' || search_query || '%'
        OR p.first_name ILIKE '%' || search_query || '%'
        OR p.last_name ILIKE '%' || search_query || '%'
        OR p.primary_specialty ILIKE '%' || search_query || '%'
        OR p.primary_service_name ILIKE '%' || search_query || '%'
        OR p.primary_service_name_nl ILIKE '%' || search_query || '%'
        OR p.company_name ILIKE '%' || search_query || '%'
        OR p.company_city ILIKE '%' || search_query || '%'
        OR p.company_state_region ILIKE '%' || search_query || '%'
        OR p.bio ILIKE '%' || search_query || '%'
        OR (
          p.services_offered IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM unnest(p.services_offered) service
            WHERE service ILIKE '%' || search_query || '%'
          )
        )
      )
    )
    AND (country_filter IS NULL OR p.searchable_country = lower(trim(country_filter)))
    AND (state_filter IS NULL OR p.searchable_state_region = lower(trim(state_filter)))
    AND (
      city_filters IS NULL OR array_length(city_filters, 1) IS NULL
      OR p.searchable_city = ANY(SELECT lower(trim(cf)) FROM unnest(city_filters) cf)
    )
    AND (max_hourly_rate IS NULL OR p.hourly_rate_max <= max_hourly_rate)
    AND (
      category_filters IS NULL OR array_length(category_filters, 1) IS NULL
      OR p.specialty_parent_ids && category_filters
    )
    AND (
      service_filters IS NULL OR array_length(service_filters, 1) IS NULL
      OR p.specialty_ids && service_filters
    )
  ORDER BY
    (CASE WHEN sort_by = 'featured' AND COALESCE(c.is_featured, FALSE) THEN 0 ELSE 1 END),
    (CASE WHEN sort_by IN ('most_relevant', 'featured') THEN -COALESCE(cc.credited_sum, 0) ELSE 0 END),
    (CASE WHEN sort_by = 'popular' THEN -COALESCE(c.views_count, 0) ELSE 0 END),
    p.created_at DESC
  LIMIT limit_count OFFSET offset_count;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- Phase 5: rebuild saved-summary RPCs (drop rating cols)
-- ────────────────────────────────────────────────────────────────────────

CREATE FUNCTION public.get_user_saved_companies_with_summary()
RETURNS TABLE(
  saved_at timestamp with time zone, professional_id uuid, company_id uuid,
  company_name text, company_slug text, company_logo text, company_domain text,
  company_city text, company_country text, company_state_region text,
  title text, first_name text, last_name text,
  primary_specialty text, primary_service_name text, services_offered text[],
  user_location text, is_verified boolean, cover_url text, logo_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    sc.created_at AS saved_at,
    c.id AS professional_id,
    c.id AS company_id,
    c.name AS company_name,
    c.slug AS company_slug,
    c.logo_url AS company_logo,
    c.domain AS company_domain,
    c.city AS company_city,
    c.country AS company_country,
    c.state_region AS company_state_region,
    c.professional_title AS title,
    c.first_name,
    c.last_name,
    c.primary_service AS primary_specialty,
    c.primary_service_name,
    c.services_offered,
    c.user_location,
    c.is_verified,
    c.cover_photo_url AS cover_url,
    c.logo_url AS logo_url
  FROM saved_companies sc
  INNER JOIN mv_company_listings c ON sc.company_id = c.id
  WHERE sc.user_id = auth.uid()
  ORDER BY sc.created_at DESC;
$$;

CREATE FUNCTION public.get_user_saved_professionals_with_summary()
RETURNS TABLE(
  saved_at timestamp with time zone, professional_id uuid, company_id uuid,
  company_name text, company_domain text, title text,
  primary_specialty text, user_location text, cover_url text, logo_url text,
  services_offered text[], is_verified boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    mv.id AS professional_id,
    p.company_id,
    c.name AS company_name,
    c.domain AS company_domain,
    COALESCE(mv.title, p.title) AS title,
    mv.primary_specialty,
    COALESCE(NULLIF(trim(both ' ' from concat_ws(', ', c.city, c.country)), ''), mv.user_location) AS user_location,
    cp.url AS cover_url,
    COALESCE(cp.url, c.logo_url, mv.avatar_url, mv.company_logo) AS logo_url,
    p.services_offered,
    mv.is_verified
  FROM public.saved_professionals sp
  JOIN public.professionals p ON sp.professional_id = p.id
  JOIN public.mv_professional_summary mv ON mv.id = p.id
  LEFT JOIN public.companies c ON p.company_id = c.id
  LEFT JOIN public.company_photos cp ON cp.company_id = c.id AND cp.is_cover = true
  WHERE sp.user_id = v_user_id
  ORDER BY sp.created_at DESC;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- Phase 6: rebuild get_platform_stats (drop review fields)
-- ────────────────────────────────────────────────────────────────────────

CREATE FUNCTION public.get_platform_stats()
RETURNS TABLE(
  total_professionals integer,
  verified_professionals integer,
  total_projects integer,
  published_projects integer,
  total_users integer
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM public.professionals) AS total_professionals,
    (SELECT COUNT(*)::INTEGER FROM public.professionals WHERE is_verified = TRUE) AS verified_professionals,
    (SELECT COUNT(*)::INTEGER FROM public.projects) AS total_projects,
    (SELECT COUNT(*)::INTEGER FROM public.projects WHERE status = 'published') AS published_projects,
    (SELECT COUNT(*)::INTEGER FROM public.profiles WHERE is_active = TRUE) AS total_users;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- Phase 7: re-grant permissions on rebuilt objects
-- ────────────────────────────────────────────────────────────────────────

-- count_professionals also referenced display_rating + min_rating.
-- mv_professional_summary no longer exposes display_rating, so the
-- existing function body would fail at call time. Rebuild without
-- rating-related fields; drop the old 9-arg signature.
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
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE result bigint;
BEGIN
  SELECT count(*) INTO result
  FROM public.mv_professional_summary p
  WHERE
    p.company_status IN ('listed', 'prospected')
    AND (NOT verified_only OR p.is_verified = TRUE)
    AND (search_query IS NULL OR (
      p.title ILIKE '%' || search_query || '%'
      OR p.first_name ILIKE '%' || search_query || '%'
      OR p.last_name ILIKE '%' || search_query || '%'
      OR p.primary_specialty ILIKE '%' || search_query || '%'
      OR p.primary_service_name ILIKE '%' || search_query || '%'
      OR p.primary_service_name_nl ILIKE '%' || search_query || '%'
      OR p.company_name ILIKE '%' || search_query || '%'
      OR p.company_city ILIKE '%' || search_query || '%'
      OR p.company_state_region ILIKE '%' || search_query || '%'
      OR p.bio ILIKE '%' || search_query || '%'
      OR (p.services_offered IS NOT NULL AND EXISTS (
        SELECT 1 FROM unnest(p.services_offered) service
        WHERE service ILIKE '%' || search_query || '%'))))
    AND (country_filter IS NULL OR p.searchable_country = lower(trim(country_filter)))
    AND (state_filter IS NULL OR p.searchable_state_region = lower(trim(state_filter)))
    AND (city_filters IS NULL OR array_length(city_filters, 1) IS NULL
         OR p.searchable_city = ANY(SELECT lower(trim(cf)) FROM unnest(city_filters) cf))
    AND (max_hourly_rate IS NULL OR p.hourly_rate_max <= max_hourly_rate)
    AND (category_filters IS NULL OR array_length(category_filters, 1) IS NULL
         OR p.specialty_parent_ids && category_filters)
    AND (service_filters IS NULL OR array_length(service_filters, 1) IS NULL
         OR p.specialty_ids && service_filters);
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.count_professionals(text, text, text, text[], uuid[], uuid[], numeric, numeric, boolean);

GRANT SELECT ON public.mv_company_listings TO anon, authenticated;
GRANT SELECT ON public.mv_professional_summary TO anon, authenticated;
GRANT SELECT ON public.company_metrics TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_professionals(text, text, text, text[], uuid[], uuid[], numeric, boolean, integer, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_professionals(text, text, text, text[], uuid[], uuid[], numeric, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_saved_companies_with_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_saved_professionals_with_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated;
