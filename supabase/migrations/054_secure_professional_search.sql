-- Migration: Secure professional search RPC with definer rights
-- Ensures anonymous/authenticated callers can execute search_professionals
-- after mv_professional_summary access restrictions.

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
    AND (
      search_query IS NULL
      OR p.search_vector @@ plainto_tsquery('simple', search_query)
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

GRANT EXECUTE ON FUNCTION public.search_professionals(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID[],
  UUID[],
  DECIMAL,
  DECIMAL,
  BOOLEAN,
  INTEGER,
  INTEGER
) TO anon;

GRANT EXECUTE ON FUNCTION public.search_professionals(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID[],
  UUID[],
  DECIMAL,
  DECIMAL,
  BOOLEAN,
  INTEGER,
  INTEGER
) TO authenticated;
