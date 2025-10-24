-- Migration: Update materialized views and functions to use company_ratings
-- Description: Update all views and functions that reference professional_ratings to use company_ratings

-- Update mv_professional_summary materialized view
DROP MATERIALIZED VIEW IF EXISTS public.mv_professional_summary;

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
  c.id as company_id_full,
  c.name as company_name,
  c.slug as company_slug,
  c.logo_url as company_logo_url,
  c.city as company_city,
  c.country as company_country,
  c.domain as company_domain,
  c.status as company_status,
  c.plan_tier as company_plan_tier,
  c.is_featured as company_is_featured,
  prof.first_name,
  prof.last_name,
  prof.avatar_url,
  prof.location as profile_location,
  COALESCE(cr.overall_rating, 0) as overall_rating,
  COALESCE(cr.total_reviews, 0) as total_reviews,
  COALESCE(cr.quality_rating, 0) as quality_rating,
  COALESCE(cr.reliability_rating, 0) as reliability_rating,
  COALESCE(cr.communication_rating, 0) as communication_rating,
  cr.last_review_at,
  ARRAY_AGG(DISTINCT cat.name) FILTER (WHERE cat.name IS NOT NULL) as specialties
FROM public.professionals p
INNER JOIN public.companies c ON p.company_id = c.id
LEFT JOIN public.profiles prof ON p.user_id = prof.id
LEFT JOIN public.company_ratings cr ON p.company_id = cr.company_id
LEFT JOIN public.professional_specialties ps ON p.id = ps.professional_id
LEFT JOIN public.categories cat ON ps.category_id = cat.id
GROUP BY
  p.id, p.user_id, p.company_id, p.title, p.bio, p.is_verified, p.is_available,
  p.years_experience, p.hourly_rate_min, p.hourly_rate_max, p.portfolio_url,
  p.languages_spoken, p.services_offered, p.created_at, p.updated_at,
  c.id, c.name, c.slug, c.logo_url, c.city, c.country, c.domain, c.status, c.plan_tier, c.is_featured,
  prof.first_name, prof.last_name, prof.avatar_url, prof.location,
  cr.overall_rating, cr.total_reviews, cr.quality_rating, cr.reliability_rating, cr.communication_rating, cr.last_review_at;

-- Create indexes on the materialized view
CREATE UNIQUE INDEX mv_professional_summary_id_idx ON public.mv_professional_summary (id);
CREATE INDEX mv_professional_summary_company_idx ON public.mv_professional_summary (company_id);
CREATE INDEX mv_professional_summary_available_verified_idx ON public.mv_professional_summary (is_available, is_verified);
CREATE INDEX mv_professional_summary_rating_idx ON public.mv_professional_summary (overall_rating DESC);
CREATE INDEX mv_professional_summary_featured_idx ON public.mv_professional_summary (company_is_featured) WHERE company_is_featured = true;

-- Update search_professionals_optimized function
CREATE OR REPLACE FUNCTION public.search_professionals_optimized(
  search_query TEXT DEFAULT NULL,
  location_filter TEXT DEFAULT NULL,
  category_filter UUID DEFAULT NULL,
  verified_only BOOLEAN DEFAULT FALSE,
  available_only BOOLEAN DEFAULT TRUE,
  min_rating DECIMAL DEFAULT NULL,
  sort_by TEXT DEFAULT 'rating',
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  company_id UUID,
  company_name TEXT,
  company_slug TEXT,
  company_logo_url TEXT,
  company_city TEXT,
  company_country TEXT,
  company_domain TEXT,
  title TEXT,
  bio TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  profile_location TEXT,
  is_verified BOOLEAN,
  is_available BOOLEAN,
  years_experience INTEGER,
  hourly_rate_min DECIMAL,
  hourly_rate_max DECIMAL,
  overall_rating DECIMAL,
  total_reviews INTEGER,
  specialties TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.company_id,
    c.name as company_name,
    c.slug as company_slug,
    c.logo_url as company_logo_url,
    c.city as company_city,
    c.country as company_country,
    c.domain as company_domain,
    p.title,
    p.bio,
    prof.first_name,
    prof.last_name,
    prof.avatar_url,
    prof.location as profile_location,
    p.is_verified,
    p.is_available,
    p.years_experience,
    p.hourly_rate_min,
    p.hourly_rate_max,
    COALESCE(cr.overall_rating, 0) as overall_rating,
    COALESCE(cr.total_reviews, 0) as total_reviews,
    ARRAY_AGG(DISTINCT cat.name) FILTER (WHERE cat.name IS NOT NULL) as specialties
  FROM public.professionals p
  INNER JOIN public.companies c ON p.company_id = c.id
  LEFT JOIN public.profiles prof ON p.user_id = prof.id
  LEFT JOIN public.company_ratings cr ON p.company_id = cr.company_id
  LEFT JOIN public.professional_specialties ps ON p.id = ps.professional_id
  LEFT JOIN public.categories cat ON ps.category_id = cat.id
  WHERE
    (NOT available_only OR p.is_available = TRUE)
    AND (NOT verified_only OR p.is_verified = TRUE)
    AND (c.status = 'active')
    AND (c.plan_tier IN ('plus', 'premium'))
    AND (min_rating IS NULL OR COALESCE(cr.overall_rating, 0) >= min_rating)
    AND (location_filter IS NULL OR
         c.city ILIKE '%' || location_filter || '%' OR
         c.country ILIKE '%' || location_filter || '%' OR
         prof.location ILIKE '%' || location_filter || '%')
    AND (category_filter IS NULL OR ps.category_id = category_filter)
    AND (search_query IS NULL OR
         c.name ILIKE '%' || search_query || '%' OR
         p.title ILIKE '%' || search_query || '%' OR
         p.bio ILIKE '%' || search_query || '%' OR
         cat.name ILIKE '%' || search_query || '%')
  GROUP BY
    p.id, p.user_id, p.company_id, p.title, p.bio, p.is_verified, p.is_available,
    p.years_experience, p.hourly_rate_min, p.hourly_rate_max,
    c.id, c.name, c.slug, c.logo_url, c.city, c.country, c.domain,
    prof.first_name, prof.last_name, prof.avatar_url, prof.location,
    cr.overall_rating, cr.total_reviews
  ORDER BY
    CASE WHEN sort_by = 'rating' THEN COALESCE(cr.overall_rating, 0) END DESC,
    CASE WHEN sort_by = 'reviews' THEN COALESCE(cr.total_reviews, 0) END DESC,
    CASE WHEN sort_by = 'recent' THEN p.created_at END DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON public.mv_professional_summary TO anon;
GRANT SELECT ON public.mv_professional_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_professionals_optimized TO anon;
GRANT EXECUTE ON FUNCTION public.search_professionals_optimized TO authenticated;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW public.mv_professional_summary;
