-- Exclude pro-audience companies (photographers) from the homeowner-facing
-- /professionals discovery surface.
--
-- mv_professional_summary feeds search_professionals + count_professionals,
-- which power the public /professionals listing. We exclude pro-audience
-- companies at the materialized view level so any direct reader of the mv
-- gets the right behaviour automatically — no per-call parameter needed.
--
-- Photographer pages will query `public.companies` directly (see Phase 4),
-- which is unaffected.
--
-- This migration follows the recreate pattern from 092 / 093 / 105 — drop +
-- recreate the matview rather than CREATE OR REPLACE (which Postgres doesn't
-- support for materialized views).

DROP MATERIALIZED VIEW IF EXISTS public.mv_professional_summary CASCADE;

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
      SELECT c.primary_service_id::text
      WHERE c.primary_service_id IS NOT NULL
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
  COALESCE(cr.overall_rating, 0::numeric) AS display_rating,
  COALESCE(cr.total_reviews, 0) AS total_reviews,
  COALESCE(cr.quality_rating, 0::numeric) AS quality_rating,
  COALESCE(cr.reliability_rating, 0::numeric) AS reliability_rating,
  COALESCE(cr.communication_rating, 0::numeric) AS communication_rating,
  cr.last_review_at,
  CASE
    WHEN p.hourly_rate_min IS NOT NULL AND p.hourly_rate_max IS NOT NULL
      THEN ((('€' || p.hourly_rate_min) || ' - €') || p.hourly_rate_max) || '/hr'
    WHEN p.hourly_rate_min IS NOT NULL THEN ('€' || p.hourly_rate_min) || '/hr'
    WHEN p.hourly_rate_max IS NOT NULL THEN ('€' || p.hourly_rate_max) || '/hr'
    ELSE NULL
  END AS hourly_rate_display,
  lower(trim(both from coalesce(c.country, ''))) AS searchable_country,
  lower(trim(both from coalesce(c.state_region, ''))) AS searchable_state_region,
  lower(trim(both from coalesce(c.city, ''))) AS searchable_city,
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
  COALESCE(
    c.hero_photo_url,
    (
      SELECT cp.url FROM company_photos cp
      WHERE cp.company_id = c.id AND cp.is_cover = true
      ORDER BY cp.order_index LIMIT 1
    ),
    (
      SELECT cp.url FROM company_photos cp
      WHERE cp.company_id = c.id
      ORDER BY cp.order_index LIMIT 1
    ),
    (
      SELECT pp.url
      FROM project_photos pp
      JOIN project_professionals prp ON pp.project_id = prp.project_id
      WHERE prp.company_id = c.id
      ORDER BY pp.is_primary DESC NULLS LAST, pp.order_index
      LIMIT 1
    )
  ) AS cover_photo_url
FROM companies c
LEFT JOIN professionals p ON p.company_id = c.id
LEFT JOIN categories primary_cat ON c.primary_service_id = primary_cat.id
LEFT JOIN profiles prof ON p.user_id = prof.id
LEFT JOIN company_ratings cr ON c.id = cr.company_id
WHERE
  c.status = ANY (ARRAY['listed'::company_status, 'unlisted'::company_status, 'prospected'::company_status])
  AND c.audience = 'homeowner'   -- exclude photographers + future pro-audience categories
GROUP BY
  p.id, p.user_id, p.company_id, p.title, p.bio, p.is_verified, p.is_available,
  p.years_experience, p.hourly_rate_min, p.hourly_rate_max, p.portfolio_url,
  p.languages_spoken, p.created_at, p.updated_at,
  c.id, c.name, c.slug, c.logo_url, c.city, c.state_region, c.country, c.domain,
  c.status, c.plan_tier, c.plan_expires_at, c.is_featured, c.services_offered,
  c.hero_photo_url, c.primary_service_id, c.latitude, c.longitude, c.description,
  c.is_verified, c.created_at, c.updated_at, c.audience,
  primary_cat.name, primary_cat.name_nl, primary_cat.slug,
  prof.first_name, prof.last_name, prof.avatar_url, prof.location,
  cr.overall_rating, cr.total_reviews, cr.quality_rating, cr.reliability_rating,
  cr.communication_rating, cr.last_review_at;

-- Recreate the unique index that existed on the prior matview. Required for
-- REFRESH MATERIALIZED VIEW CONCURRENTLY downstream.
CREATE UNIQUE INDEX IF NOT EXISTS mv_professional_summary_company_id_full_idx
  ON public.mv_professional_summary (company_id_full);

-- DROP MATERIALIZED VIEW ... CASCADE above also dropped search_professionals
-- and count_professionals. Recreate them here verbatim from migration 142
-- (the latest definition) so this migration is a complete, atomic unit.

CREATE OR REPLACE FUNCTION public.search_professionals(
  search_query TEXT DEFAULT NULL,
  country_filter TEXT DEFAULT NULL,
  state_filter TEXT DEFAULT NULL,
  city_filters TEXT[] DEFAULT NULL,
  category_filters UUID[] DEFAULT NULL,
  service_filters UUID[] DEFAULT NULL,
  min_rating DECIMAL DEFAULT NULL,
  max_hourly_rate DECIMAL DEFAULT NULL,
  verified_only BOOLEAN DEFAULT FALSE,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0,
  sort_by TEXT DEFAULT 'most_relevant'
)
RETURNS TABLE (
  id UUID, user_id UUID, first_name TEXT, last_name TEXT, avatar_url TEXT,
  user_location TEXT, title TEXT, company_id UUID, company_name TEXT,
  company_slug TEXT, company_logo TEXT, company_domain TEXT, company_city TEXT,
  company_state_region TEXT, company_country TEXT, company_latitude DOUBLE PRECISION,
  company_longitude DOUBLE PRECISION, primary_specialty TEXT, primary_service_name TEXT,
  services_offered TEXT[], display_rating DECIMAL, total_reviews INTEGER,
  hourly_rate_display TEXT, is_verified BOOLEAN, specialty_ids UUID[],
  specialty_parent_ids UUID[], cover_photo_url TEXT,
  credited_sum INTEGER, views_count INTEGER, is_featured BOOLEAN
) AS $$
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
    p.display_rating, p.total_reviews, p.hourly_rate_display, p.is_verified,
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
    AND (min_rating IS NULL OR p.display_rating >= min_rating)
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.count_professionals(
  search_query text DEFAULT NULL,
  country_filter text DEFAULT NULL,
  state_filter text DEFAULT NULL,
  city_filters text[] DEFAULT NULL,
  category_filters uuid[] DEFAULT NULL,
  service_filters uuid[] DEFAULT NULL,
  min_rating numeric DEFAULT NULL,
  max_hourly_rate numeric DEFAULT NULL,
  verified_only boolean DEFAULT false
)
RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  result bigint;
BEGIN
  SELECT count(*) INTO result
  FROM public.mv_professional_summary p
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
    AND (min_rating IS NULL OR p.display_rating >= min_rating)
    AND (max_hourly_rate IS NULL OR p.hourly_rate_max <= max_hourly_rate)
    AND (
      category_filters IS NULL OR array_length(category_filters, 1) IS NULL
      OR p.specialty_parent_ids && category_filters
    )
    AND (
      service_filters IS NULL OR array_length(service_filters, 1) IS NULL
      OR p.specialty_ids && service_filters
    );

  RETURN result;
END;
$function$;

REFRESH MATERIALIZED VIEW public.mv_professional_summary;
