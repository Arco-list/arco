-- Migration: Add cover photo to professional search results
-- Description: Update mv_professional_summary to include company cover photo URL

-- Drop the existing view
DROP MATERIALIZED VIEW IF EXISTS public.mv_professional_summary CASCADE;

-- Recreate with cover photo
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
  ARRAY_AGG(DISTINCT cat.parent_id) FILTER (WHERE cat.parent_id IS NOT NULL) as specialty_parent_ids,
  -- Cover photo URL (first photo marked as cover, or first photo if no cover marked)
  (
    SELECT COALESCE(
      (SELECT url FROM public.company_photos WHERE company_id = c.id AND is_cover = TRUE ORDER BY order_index LIMIT 1),
      (SELECT url FROM public.company_photos WHERE company_id = c.id ORDER BY order_index LIMIT 1)
    )
  ) as cover_photo_url
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

-- Drop existing function first (required to change return type)
DROP FUNCTION IF EXISTS public.search_professionals(
  TEXT, TEXT, TEXT, TEXT, UUID[], UUID[], DECIMAL, DECIMAL, BOOLEAN, INTEGER, INTEGER
);

-- Now create search_professionals function with cover_photo_url
CREATE FUNCTION public.search_professionals(
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
  company_slug TEXT,
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
  specialty_parent_ids UUID[],
  cover_photo_url TEXT
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
    p.company_slug,
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
    p.specialty_parent_ids,
    p.cover_photo_url
  FROM public.mv_professional_summary p
  WHERE
    p.is_available = TRUE
    AND p.company_plan_tier = 'plus'
    AND p.company_status = 'listed'
    AND (p.company_plan_expires_at IS NULL OR p.company_plan_expires_at > NOW())
    AND (NOT verified_only OR p.is_verified = TRUE)
    AND (
      search_query IS NULL OR (
        p.title ILIKE '%' || search_query || '%'
        OR p.first_name ILIKE '%' || search_query || '%'
        OR p.last_name ILIKE '%' || search_query || '%'
        OR p.primary_specialty ILIKE '%' || search_query || '%'
        OR p.company_name ILIKE '%' || search_query || '%'
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.search_professionals(
  TEXT, TEXT, TEXT, TEXT, UUID[], UUID[], DECIMAL, DECIMAL, BOOLEAN, INTEGER, INTEGER
) TO anon, authenticated;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW public.mv_professional_summary;
