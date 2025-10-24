-- Migration: Add is_featured to mv_professional_summary
-- Purpose: Admin panel needs is_featured column to show/manage featured professionals
-- Date: 2025-10-24

-- Drop and recreate the materialized view with is_featured
DROP MATERIALIZED VIEW IF EXISTS public.mv_professional_summary CASCADE;

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
  p.is_featured,
  p.services_offered,
  p.languages_spoken,
  p.portfolio_url,
  p.company_id,
  c.name AS company_name,
  c.slug AS company_slug,
  c.logo_url AS company_logo,
  c.domain AS company_domain,
  c.city AS company_city,
  c.state_region AS company_state_region,
  c.country AS company_country,
  c.plan_tier AS company_plan_tier,
  c.plan_expires_at AS company_plan_expires_at,
  c.status AS company_status,
  pr.overall_rating,
  pr.quality_rating,
  pr.reliability_rating,
  pr.communication_rating,
  pr.total_reviews,
  pr.last_review_at,
  COALESCE(
    (SELECT cat.name FROM public.professional_specialties ps
     JOIN public.categories cat ON ps.category_id = cat.id
     WHERE ps.professional_id = p.id AND ps.is_primary = TRUE
     LIMIT 1),
    (SELECT cat.name FROM public.professional_specialties ps
     JOIN public.categories cat ON ps.category_id = cat.id
     WHERE ps.professional_id = p.id
     LIMIT 1)
  ) AS primary_specialty,
  COALESCE(
    (SELECT cat.slug FROM public.professional_specialties ps
     JOIN public.categories cat ON ps.category_id = cat.id
     WHERE ps.professional_id = p.id AND ps.is_primary = TRUE
     LIMIT 1),
    (SELECT cat.slug FROM public.professional_specialties ps
     JOIN public.categories cat ON ps.category_id = cat.id
     WHERE ps.professional_id = p.id
     LIMIT 1)
  ) AS primary_specialty_slug,
  CASE
    WHEN pr.total_reviews = 0 THEN 0
    ELSE pr.overall_rating
  END AS display_rating,
  COALESCE(sa.specialty_ids, ARRAY[]::uuid[]) AS specialty_ids,
  COALESCE(sa.specialty_slugs, ARRAY[]::text[]) AS specialty_slugs,
  COALESCE(sa.specialty_names, ARRAY[]::text[]) AS specialty_names,
  COALESCE(sa.specialty_parent_ids, ARRAY[]::uuid[]) AS specialty_parent_ids,
  COALESCE(sa.specialty_parent_slugs, ARRAY[]::text[]) AS specialty_parent_slugs,
  COALESCE(sa.specialty_parent_names, ARRAY[]::text[]) AS specialty_parent_names,
  COALESCE(pl.profile_city, c.city) AS location_city,
  COALESCE(pl.profile_region, c.state_region) AS location_region,
  COALESCE(pl.profile_country, c.country) AS location_country
FROM public.professionals p
LEFT JOIN public.profiles prof ON p.user_id = prof.id
LEFT JOIN public.companies c ON p.company_id = c.id
LEFT JOIN public.professional_ratings pr ON p.id = pr.professional_id
LEFT JOIN specialty_agg sa ON p.id = sa.professional_id
LEFT JOIN profile_location pl ON p.user_id = pl.profile_id
WHERE
  p.is_available = TRUE
  AND c.id IS NOT NULL
  AND c.plan_tier = 'plus'
  AND c.status = 'listed'
  AND (c.plan_expires_at IS NULL OR c.plan_expires_at > NOW());

-- Create indexes
CREATE INDEX idx_mv_professional_summary_company_id ON public.mv_professional_summary(company_id);
CREATE INDEX idx_mv_professional_summary_is_featured ON public.mv_professional_summary(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_mv_professional_summary_location ON public.mv_professional_summary(location_country, location_region, location_city);
CREATE INDEX idx_mv_professional_summary_rating ON public.mv_professional_summary(display_rating DESC) WHERE display_rating > 0;
CREATE INDEX idx_mv_professional_summary_specialty_ids ON public.mv_professional_summary USING GIN(specialty_ids);
CREATE INDEX idx_mv_professional_summary_specialty_parent_ids ON public.mv_professional_summary USING GIN(specialty_parent_ids);

-- Grant access
GRANT SELECT ON public.mv_professional_summary TO authenticated, anon;

-- Add comment
COMMENT ON MATERIALIZED VIEW public.mv_professional_summary IS
  'Optimized professional summary view with company and specialty information. Includes is_featured for admin panel.';
