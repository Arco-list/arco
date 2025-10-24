-- Migration: Fix mv_professional_summary view to include all required columns
-- Description: Update the materialized view to match what search_professionals expects

DROP MATERIALIZED VIEW IF EXISTS public.mv_professional_summary CASCADE;

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
  p.services_offered,
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
  -- Profile fields
  prof.first_name,
  prof.last_name,
  prof.avatar_url,
  prof.location as user_location,
  -- Rating fields from company_ratings
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
  -- Primary specialty
  (
    SELECT cat.name
    FROM public.professional_specialties ps2
    JOIN public.categories cat ON ps2.category_id = cat.id
    WHERE ps2.professional_id = p.id AND ps2.is_primary = TRUE
    LIMIT 1
  ) as primary_specialty,
  -- Specialty IDs and parent IDs
  ARRAY_AGG(DISTINCT ps.category_id) FILTER (WHERE ps.category_id IS NOT NULL) as specialty_ids,
  ARRAY_AGG(DISTINCT cat.parent_id) FILTER (WHERE cat.parent_id IS NOT NULL) as specialty_parent_ids
FROM public.professionals p
INNER JOIN public.companies c ON p.company_id = c.id
LEFT JOIN public.profiles prof ON p.user_id = prof.id
LEFT JOIN public.company_ratings cr ON c.id = cr.company_id
LEFT JOIN public.professional_specialties ps ON p.id = ps.professional_id
LEFT JOIN public.categories cat ON ps.category_id = cat.id
GROUP BY
  p.id, p.user_id, p.company_id, p.title, p.bio, p.is_verified, p.is_available,
  p.years_experience, p.hourly_rate_min, p.hourly_rate_max, p.portfolio_url,
  p.languages_spoken, p.services_offered, p.created_at, p.updated_at,
  c.id, c.name, c.slug, c.logo_url, c.city, c.state_region, c.country, c.domain,
  c.status, c.plan_tier, c.plan_expires_at, c.is_featured,
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
