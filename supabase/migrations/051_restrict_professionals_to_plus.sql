-- Migration: Restrict professional listings to Plus plan companies
-- Description: Ensures only professionals whose companies are on the Plus plan (and actively listed)
--              surface in listings/search by enriching the summary view and RPC filter.

-- Drop dependent view before recreating the materialized view
DROP VIEW IF EXISTS public.professional_search_documents;

-- Recreate the professional summary materialized view with plan metadata
DROP MATERIALIZED VIEW IF EXISTS public.mv_professional_summary;

CREATE MATERIALIZED VIEW public.mv_professional_summary AS
WITH specialty_agg AS (
  SELECT
    ps.professional_id,
    array_remove(array_agg(DISTINCT cat.id), NULL::uuid) AS specialty_ids,
    array_remove(array_agg(DISTINCT cat.slug), NULL::text) AS specialty_slugs,
    array_remove(array_agg(DISTINCT cat.name), NULL::text) AS specialty_names,
    array_remove(array_agg(DISTINCT parent.id), NULL::uuid) AS specialty_parent_ids,
    array_remove(array_agg(DISTINCT parent.slug), NULL::text) AS specialty_parent_slugs,
    array_remove(array_agg(DISTINCT parent.name), NULL::text) AS specialty_parent_names
  FROM public.professional_specialties ps
  JOIN public.categories cat ON ps.category_id = cat.id
  LEFT JOIN public.categories parent ON cat.parent_id = parent.id
  GROUP BY ps.professional_id
),
profile_location AS (
  SELECT
    prof.id AS profile_id,
    prof.location,
    CASE
      WHEN prof.location IS NULL OR prof.location = '' THEN NULL
      ELSE trim((regexp_split_to_array(prof.location, ','))[1])
    END AS profile_city,
    CASE
      WHEN prof.location IS NULL OR prof.location = '' THEN NULL
      ELSE trim((regexp_split_to_array(prof.location, ','))[2])
    END AS profile_region,
    CASE
      WHEN prof.location IS NULL OR prof.location = '' THEN NULL
      ELSE trim((regexp_split_to_array(prof.location, ','))[array_length(regexp_split_to_array(prof.location, ','), 1)])
    END AS profile_country
  FROM public.profiles prof
)
SELECT
  p.id,
  p.user_id,
  prof.first_name,
  prof.last_name,
  prof.avatar_url,
  prof.location AS user_location,
  p.title,
  p.bio,
  p.years_experience,
  p.hourly_rate_min,
  p.hourly_rate_max,
  p.is_verified,
  p.is_available,
  p.services_offered,
  p.languages_spoken,
  p.portfolio_url,
  c.id AS company_id,
  c.name AS company_name,
  c.logo_url AS company_logo,
  c.domain AS company_domain,
  c.city AS company_city,
  c.state_region AS company_state_region,
  c.country AS company_country,
  c.plan_tier AS company_plan_tier,
  c.status AS company_status,
  c.plan_expires_at AS company_plan_expires_at,
  pr.overall_rating,
  pr.quality_rating,
  pr.reliability_rating,
  pr.communication_rating,
  pr.total_reviews,
  pr.last_review_at,
  cat.name AS primary_specialty,
  cat.slug AS primary_specialty_slug,
  cat.id AS primary_specialty_id,
  cat.icon AS primary_specialty_icon,
  cat.color AS primary_specialty_color,
  spec.specialty_ids,
  spec.specialty_slugs,
  spec.specialty_names,
  spec.specialty_parent_ids,
  spec.specialty_parent_slugs,
  spec.specialty_parent_names,
  CASE
    WHEN pr.total_reviews = 0 THEN 0
    ELSE pr.overall_rating
  END AS display_rating,
  CASE
    WHEN p.hourly_rate_min IS NOT NULL AND p.hourly_rate_max IS NOT NULL
      THEN p.hourly_rate_min || ' - ' || p.hourly_rate_max || ' EUR/hour'
    ELSE NULL
  END AS hourly_rate_display,
  lower(trim(coalesce(c.country, loc.profile_country))) AS searchable_country,
  lower(trim(coalesce(c.state_region, loc.profile_region))) AS searchable_state_region,
  lower(trim(coalesce(c.city, loc.profile_city))) AS searchable_city,
  p.created_at,
  p.updated_at
FROM public.professionals p
JOIN public.profiles prof ON p.user_id = prof.id
LEFT JOIN profile_location loc ON loc.profile_id = prof.id
LEFT JOIN public.companies c ON p.company_id = c.id
LEFT JOIN public.professional_ratings pr ON p.id = pr.professional_id
LEFT JOIN public.professional_specialties ps ON p.id = ps.professional_id AND ps.is_primary = TRUE
LEFT JOIN public.categories cat ON ps.category_id = cat.id
LEFT JOIN specialty_agg spec ON spec.professional_id = p.id
WHERE prof.is_active = TRUE;

-- Recreate indexes for the refreshed materialized view
CREATE UNIQUE INDEX idx_mv_professional_summary_id ON public.mv_professional_summary(id);
CREATE INDEX idx_mv_professional_summary_location ON public.mv_professional_summary(user_location);
CREATE INDEX idx_mv_professional_summary_verified ON public.mv_professional_summary(is_verified) WHERE is_verified = TRUE;
CREATE INDEX idx_mv_professional_summary_available ON public.mv_professional_summary(is_available) WHERE is_available = TRUE;
CREATE INDEX idx_mv_professional_summary_rating ON public.mv_professional_summary(display_rating DESC);
CREATE INDEX idx_mv_professional_summary_primary_specialty ON public.mv_professional_summary(primary_specialty);
CREATE INDEX idx_mv_professional_summary_country ON public.mv_professional_summary(searchable_country);
CREATE INDEX idx_mv_professional_summary_state ON public.mv_professional_summary(searchable_state_region);
CREATE INDEX idx_mv_professional_summary_city ON public.mv_professional_summary(searchable_city);
CREATE INDEX idx_mv_professional_summary_specialty_ids ON public.mv_professional_summary USING gin(specialty_ids);
CREATE INDEX idx_mv_professional_summary_specialty_parent_ids ON public.mv_professional_summary USING gin(specialty_parent_ids);

COMMENT ON MATERIALIZED VIEW public.mv_professional_summary IS 'Optimized professional data for listings, including specialty, plan, and structured location metadata.';

-- Recreate professional search documents view with updated columns
CREATE VIEW public.professional_search_documents AS
SELECT
  p.*,
  to_tsvector(
    'simple',
    trim(
      both ' '
      FROM (
        COALESCE(p.company_name, '') || ' ' ||
        COALESCE(p.title, '') || ' ' ||
        COALESCE(p.bio, '') || ' ' ||
        COALESCE(p.user_location, '') || ' ' ||
        COALESCE(p.company_city, '') || ' ' ||
        COALESCE(p.company_state_region, '') || ' ' ||
        COALESCE(p.company_country, '') || ' ' ||
        COALESCE(p.primary_specialty, '') || ' ' ||
        COALESCE(p.primary_specialty_slug, '') || ' ' ||
        COALESCE(p.first_name, '') || ' ' ||
        COALESCE(p.last_name, '') || ' ' ||
        COALESCE(array_to_string(COALESCE(p.services_offered, ARRAY[]::text[]), ' '), '') || ' ' ||
        COALESCE(array_to_string(COALESCE(p.languages_spoken, ARRAY[]::text[]), ' '), '')
      )
    )
  ) AS search_vector
FROM public.mv_professional_summary p;

-- Update search_professionals RPC to enforce Plus plan requirement
CREATE OR REPLACE FUNCTION public.search_professionals(
  search_query TEXT DEFAULT NULL,
  country_filter TEXT DEFAULT NULL,
  state_filter TEXT DEFAULT NULL,
  city_filter TEXT DEFAULT NULL,
  category_filters UUID[] DEFAULT NULL,
  service_filters UUID[] DEFAULT NULL,
  min_rating DECIMAL DEFAULT NULL,
  max_hourly_rate DECIMAL DEFAULT NULL,
  verified_only BOOLEAN DEFAULT FALSE,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  user_location TEXT,
  title TEXT,
  company_id UUID,
  company_name TEXT,
  company_logo TEXT,
  company_domain TEXT,
  company_city TEXT,
  company_state_region TEXT,
  company_country TEXT,
  primary_specialty TEXT,
  services_offered TEXT[],
  display_rating DECIMAL,
  total_reviews INTEGER,
  hourly_rate_display TEXT,
  is_verified BOOLEAN,
  specialty_ids UUID[],
  specialty_parent_ids UUID[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.user_location,
    p.title,
    p.company_id,
    p.company_name,
    p.company_logo,
    p.company_domain,
    p.company_city,
    p.company_state_region,
    p.company_country,
    p.primary_specialty,
    p.services_offered,
    p.display_rating,
    p.total_reviews,
    p.hourly_rate_display,
    p.is_verified,
    p.specialty_ids,
    p.specialty_parent_ids
  FROM public.mv_professional_summary p
  WHERE
    p.is_available = TRUE
    AND p.company_plan_tier = 'plus'
    AND p.company_status = 'listed'
    AND (p.company_plan_expires_at IS NULL OR p.company_plan_expires_at > NOW())
    AND (NOT verified_only OR p.is_verified = TRUE)
    AND (search_query IS NULL OR (
      p.title ILIKE '%' || search_query || '%'
      OR p.first_name ILIKE '%' || search_query || '%'
      OR p.last_name ILIKE '%' || search_query || '%'
      OR p.primary_specialty ILIKE '%' || search_query || '%'
      OR p.company_name ILIKE '%' || search_query || '%'
    ))
    AND (country_filter IS NULL OR p.searchable_country = lower(trim(country_filter)))
    AND (state_filter IS NULL OR p.searchable_state_region = lower(trim(state_filter)))
    AND (city_filter IS NULL OR p.searchable_city = lower(trim(city_filter)))
    AND (min_rating IS NULL OR p.display_rating >= min_rating)
    AND (max_hourly_rate IS NULL OR p.hourly_rate_max <= max_hourly_rate)
    AND (
      category_filters IS NULL
      OR array_length(category_filters, 1) IS NULL
      OR p.specialty_parent_ids && category_filters
    )
    AND (
      service_filters IS NULL
      OR array_length(service_filters, 1) IS NULL
      OR p.specialty_ids && service_filters
    )
  ORDER BY
    p.is_verified DESC,
    p.display_rating DESC,
    p.total_reviews DESC,
    p.created_at DESC
  LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql STABLE;
