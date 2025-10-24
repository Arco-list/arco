-- Migration: Company-based professional listings
-- Description: Completely rebuild to use COMPANIES as the primary data source

-- Drop the old professional-based view
DROP MATERIALIZED VIEW IF EXISTS public.mv_professional_summary CASCADE;

-- Create company-based view for "professional" listings
-- Each row = one COMPANY that will appear in the professionals directory
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
  c.services_offered,
  c.languages,
  c.team_size_min,
  c.team_size_max,
  c.founded_year,
  c.created_at,
  c.updated_at,
  -- Ratings from company_ratings
  COALESCE(cr.overall_rating, 0) as display_rating,
  COALESCE(cr.total_reviews, 0) as total_reviews,
  COALESCE(cr.quality_rating, 0) as quality_rating,
  COALESCE(cr.reliability_rating, 0) as reliability_rating,
  COALESCE(cr.communication_rating, 0) as communication_rating,
  cr.last_review_at,
  -- Get first professional's data (for backward compatibility with UI)
  (
    SELECT p.title
    FROM public.professionals p
    WHERE p.company_id = c.id AND p.is_available = TRUE
    ORDER BY p.created_at ASC
    LIMIT 1
  ) as professional_title,
  (
    SELECT prof.first_name
    FROM public.professionals p
    JOIN public.profiles prof ON p.user_id = prof.id
    WHERE p.company_id = c.id AND p.is_available = TRUE
    ORDER BY p.created_at ASC
    LIMIT 1
  ) as first_name,
  (
    SELECT prof.last_name
    FROM public.professionals p
    JOIN public.profiles prof ON p.user_id = prof.id
    WHERE p.company_id = c.id AND p.is_available = TRUE
    ORDER BY p.created_at ASC
    LIMIT 1
  ) as last_name,
  (
    SELECT prof.avatar_url
    FROM public.professionals p
    JOIN public.profiles prof ON p.user_id = prof.id
    WHERE p.company_id = c.id AND p.is_available = TRUE
    ORDER BY p.created_at ASC
    LIMIT 1
  ) as avatar_url,
  (
    SELECT prof.location
    FROM public.professionals p
    JOIN public.profiles prof ON p.user_id = prof.id
    WHERE p.company_id = c.id AND p.is_available = TRUE
    ORDER BY p.created_at ASC
    LIMIT 1
  ) as user_location,
  -- Check if company has any available professionals
  EXISTS(
    SELECT 1 FROM public.professionals p
    WHERE p.company_id = c.id AND p.is_available = TRUE
  ) as has_available_professionals,
  -- Check if company has any verified professionals
  EXISTS(
    SELECT 1 FROM public.professionals p
    WHERE p.company_id = c.id AND p.is_verified = TRUE
  ) as is_verified,
  -- Searchable location fields
  LOWER(TRIM(COALESCE(c.country, ''))) as searchable_country,
  LOWER(TRIM(COALESCE(c.state_region, ''))) as searchable_state_region,
  LOWER(TRIM(COALESCE(c.city, ''))) as searchable_city,
  -- Primary service (first service offered)
  CASE
    WHEN c.services_offered IS NOT NULL AND array_length(c.services_offered, 1) > 0
    THEN c.services_offered[1]
    ELSE NULL
  END as primary_service,
  -- Service category IDs from professionals
  (
    SELECT ARRAY_AGG(DISTINCT ps.category_id)
    FROM public.professionals p
    JOIN public.professional_specialties ps ON p.id = ps.professional_id
    WHERE p.company_id = c.id
  ) as specialty_ids,
  -- Parent category IDs
  (
    SELECT ARRAY_AGG(DISTINCT cat.parent_id)
    FROM public.professionals p
    JOIN public.professional_specialties ps ON p.id = ps.professional_id
    JOIN public.categories cat ON ps.category_id = cat.id
    WHERE p.company_id = c.id AND cat.parent_id IS NOT NULL
  ) as specialty_parent_ids
FROM public.companies c
LEFT JOIN public.company_ratings cr ON c.id = cr.company_id
WHERE c.plan_tier = 'plus'
  AND c.status = 'listed';

-- Create indexes
CREATE UNIQUE INDEX mv_company_listings_id_idx ON public.mv_company_listings (id);
CREATE UNIQUE INDEX mv_company_listings_slug_idx ON public.mv_company_listings (slug);
CREATE INDEX mv_company_listings_rating_idx ON public.mv_company_listings (display_rating DESC);
CREATE INDEX mv_company_listings_verified_idx ON public.mv_company_listings (is_verified) WHERE is_verified = true;
CREATE INDEX mv_company_listings_featured_idx ON public.mv_company_listings (is_featured) WHERE is_featured = true;
CREATE INDEX mv_company_listings_location_idx ON public.mv_company_listings (searchable_country, searchable_state_region, searchable_city);
CREATE INDEX mv_company_listings_specialty_idx ON public.mv_company_listings USING GIN (specialty_ids);
CREATE INDEX mv_company_listings_plan_idx ON public.mv_company_listings (plan_tier, status);

-- Drop and recreate search_professionals to query COMPANIES
DROP FUNCTION IF EXISTS public.search_professionals(TEXT, TEXT, TEXT, TEXT, UUID[], UUID[], DECIMAL, DECIMAL, BOOLEAN, INTEGER, INTEGER);

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
    c.id,
    NULL::UUID as user_id,
    c.first_name,
    c.last_name,
    c.avatar_url,
    c.user_location,
    c.professional_title as title,
    c.id as company_id,
    c.name as company_name,
    c.logo_url as company_logo,
    c.domain as company_domain,
    c.city as company_city,
    c.state_region as company_state_region,
    c.country as company_country,
    c.primary_service as primary_specialty,
    c.services_offered,
    c.display_rating,
    c.total_reviews,
    NULL::TEXT as hourly_rate_display,
    c.is_verified,
    c.specialty_ids,
    c.specialty_parent_ids
  FROM public.mv_company_listings c
  WHERE
    c.has_available_professionals = TRUE
    AND (c.plan_expires_at IS NULL OR c.plan_expires_at > NOW())
    AND (NOT verified_only OR c.is_verified = TRUE)
    AND (
      search_query IS NULL OR (
        c.professional_title ILIKE '%' || search_query || '%'
        OR c.name ILIKE '%' || search_query || '%'
        OR c.description ILIKE '%' || search_query || '%'
        OR c.primary_service ILIKE '%' || search_query || '%'
        OR (
          c.services_offered IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM unnest(c.services_offered) service
            WHERE service ILIKE '%' || search_query || '%'
          )
        )
      )
    )
    AND (country_filter IS NULL OR c.searchable_country = lower(trim(country_filter)))
    AND (state_filter IS NULL OR c.searchable_state_region = lower(trim(state_filter)))
    AND (city_filter IS NULL OR c.searchable_city = lower(trim(city_filter)))
    AND (min_rating IS NULL OR c.display_rating >= min_rating)
    AND (
      category_filters IS NULL
      OR array_length(category_filters, 1) IS NULL
      OR c.specialty_parent_ids && category_filters
    )
    AND (
      service_filters IS NULL
      OR array_length(service_filters, 1) IS NULL
      OR c.specialty_ids && service_filters
    )
  ORDER BY
    c.is_verified DESC,
    c.display_rating DESC,
    c.total_reviews DESC,
    c.created_at DESC
  LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

-- Grant permissions
GRANT SELECT ON public.mv_company_listings TO anon;
GRANT SELECT ON public.mv_company_listings TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_professionals TO anon;
GRANT EXECUTE ON FUNCTION public.search_professionals TO authenticated;

-- Refresh the view
REFRESH MATERIALIZED VIEW public.mv_company_listings;
