-- ============================================================================
-- Migration 092: HOTFIX - Recreate mv_professional_summary
-- ============================================================================
-- Description: Recreate mv_professional_summary after it was dropped by CASCADE
-- Issue: Migration 090 DROP CASCADE removed this view along with mv_project_summary
-- Fix: Recreate with ALL required columns from migrations 058, 063, 074 combined
-- ============================================================================

-- Drop if exists (clean slate)
DROP MATERIALIZED VIEW IF EXISTS public.mv_professional_summary CASCADE;

-- Recreate with complete column set
CREATE MATERIALIZED VIEW public.mv_professional_summary AS
SELECT
  p.id,
  p.user_id,
  p.company_id,
  p.title,
  p.bio,
  p.is_verified,
  p.is_available,
  p.years_experience,
  p.hourly_rate_min,
  p.hourly_rate_max,
  p.portfolio_url,
  p.languages_spoken,
  -- Resolve services_offered UUIDs to category names
  (
    SELECT ARRAY_AGG(cat.name ORDER BY idx)
    FROM UNNEST(c.services_offered) WITH ORDINALITY AS t(service_id, idx)
    LEFT JOIN categories cat ON cat.id::text = service_id
    WHERE cat.name IS NOT NULL
  ) as services_offered,
  p.created_at,
  p.updated_at,

  -- Company fields
  c.id as company_id_full,
  c.name as company_name,
  c.slug as company_slug,
  c.logo_url as company_logo,
  c.city as company_city,
  c.state_region as company_state_region,
  c.country as company_country,
  c.domain as company_domain,
  c.status as company_status,
  c.plan_tier as company_plan_tier,
  c.plan_expires_at as company_plan_expires_at,
  c.is_featured as company_is_featured,

  -- PRIMARY SERVICE (from migration 074)
  primary_cat.name as primary_service_name,

  -- Profile fields
  prof.first_name,
  prof.last_name,
  prof.avatar_url,
  prof.location as user_location,

  -- Rating fields from company_ratings (from migration 063+)
  COALESCE(cr.overall_rating, 0) as display_rating,
  COALESCE(cr.total_reviews, 0) as total_reviews,
  COALESCE(cr.quality_rating, 0) as quality_rating,
  COALESCE(cr.reliability_rating, 0) as reliability_rating,
  COALESCE(cr.communication_rating, 0) as communication_rating,
  cr.last_review_at,

  -- Hourly rate display
  CASE
    WHEN p.hourly_rate_min IS NOT NULL AND p.hourly_rate_max IS NOT NULL THEN
      '€' || p.hourly_rate_min::TEXT || ' - €' || p.hourly_rate_max::TEXT || '/hr'
    WHEN p.hourly_rate_min IS NOT NULL THEN
      '€' || p.hourly_rate_min::TEXT || '/hr'
    WHEN p.hourly_rate_max IS NOT NULL THEN
      '€' || p.hourly_rate_max::TEXT || '/hr'
    ELSE NULL
  END as hourly_rate_display,

  -- Searchable location fields (lowercase, trimmed)
  LOWER(TRIM(COALESCE(c.country, ''))) as searchable_country,
  LOWER(TRIM(COALESCE(c.state_region, ''))) as searchable_state_region,
  LOWER(TRIM(COALESCE(c.city, ''))) as searchable_city,

  -- Primary specialty (from migration 058 - CRITICAL FOR APP)
  (
    SELECT cat.name
    FROM public.professional_specialties ps2
    JOIN public.categories cat ON ps2.category_id = cat.id
    WHERE ps2.professional_id = p.id AND ps2.is_primary = TRUE
    LIMIT 1
  ) as primary_specialty,

  -- Primary specialty SLUG (from migration 058 - REQUIRED BY LANDING PAGE)
  (
    SELECT cat.slug
    FROM public.professional_specialties ps2
    JOIN public.categories cat ON ps2.category_id = cat.id
    WHERE ps2.professional_id = p.id AND ps2.is_primary = TRUE
    LIMIT 1
  ) as primary_specialty_slug,

  -- Specialty IDs and parent IDs
  ARRAY_AGG(DISTINCT ps.category_id) FILTER (WHERE ps.category_id IS NOT NULL) as specialty_ids,
  ARRAY_AGG(DISTINCT cat.parent_id) FILTER (WHERE cat.parent_id IS NOT NULL) as specialty_parent_ids,

  -- Cover photo URL (from migration 074)
  (
    SELECT COALESCE(
      (SELECT url FROM public.company_photos WHERE company_id = c.id AND is_cover = TRUE ORDER BY order_index LIMIT 1),
      (SELECT url FROM public.company_photos WHERE company_id = c.id ORDER BY order_index LIMIT 1)
    )
  ) as cover_photo_url

FROM public.professionals p
INNER JOIN public.companies c ON p.company_id = c.id
LEFT JOIN public.categories primary_cat ON c.primary_service_id = primary_cat.id
LEFT JOIN public.profiles prof ON p.user_id = prof.id
LEFT JOIN public.company_ratings cr ON c.id = cr.company_id
LEFT JOIN public.professional_specialties ps ON p.id = ps.professional_id
LEFT JOIN public.categories cat ON ps.category_id = cat.id
GROUP BY
  p.id, p.user_id, p.company_id, p.title, p.bio, p.is_verified, p.is_available,
  p.years_experience, p.hourly_rate_min, p.hourly_rate_max, p.portfolio_url,
  p.languages_spoken, p.created_at, p.updated_at,
  c.id, c.name, c.slug, c.logo_url, c.city, c.state_region, c.country, c.domain,
  c.status, c.plan_tier, c.plan_expires_at, c.is_featured, c.services_offered,
  primary_cat.name,
  prof.first_name, prof.last_name, prof.avatar_url, prof.location,
  cr.overall_rating, cr.total_reviews, cr.quality_rating, cr.reliability_rating,
  cr.communication_rating, cr.last_review_at;

-- Create indexes on the materialized view
CREATE UNIQUE INDEX mv_professional_summary_id_idx ON public.mv_professional_summary (id);
CREATE INDEX mv_professional_summary_company_idx ON public.mv_professional_summary (company_id);
CREATE INDEX mv_professional_summary_available_verified_idx ON public.mv_professional_summary (is_available, is_verified);
CREATE INDEX mv_professional_summary_rating_idx ON public.mv_professional_summary (display_rating DESC);
CREATE INDEX mv_professional_summary_featured_idx ON public.mv_professional_summary (company_is_featured) WHERE company_is_featured = true;
CREATE INDEX mv_professional_summary_location_idx ON public.mv_professional_summary (searchable_country, searchable_state_region, searchable_city);
CREATE INDEX mv_professional_summary_specialty_idx ON public.mv_professional_summary USING GIN (specialty_ids);

-- Grant permissions
GRANT SELECT ON public.mv_professional_summary TO anon;
GRANT SELECT ON public.mv_professional_summary TO authenticated;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW public.mv_professional_summary;

-- Add comment
COMMENT ON MATERIALIZED VIEW public.mv_professional_summary IS
  'Complete professional summary - recreated after CASCADE drop in migration 090. Combines features from migrations 058, 063, and 074.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After applying, verify with:
-- SELECT COUNT(*) FROM public.mv_professional_summary;
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'mv_professional_summary'
-- ORDER BY ordinal_position;
-- ============================================================================
