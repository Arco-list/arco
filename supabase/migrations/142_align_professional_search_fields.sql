-- Align search_professionals/count_professionals search_query matching with the
-- popup's /api/search route, which matches across company_city, company_state_region,
-- primary_service_name, primary_service_name_nl, and bio in addition to the existing
-- fields. Without this, "ams" finds Amsterdam-based companies in the popup but
-- returns 0 results when the user clicks "Search all professionals".

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
    p.id,
    p.user_id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.user_location,
    p.title,
    COALESCE(p.company_id, p.company_id_full) AS company_id,
    p.company_name,
    p.company_slug,
    p.company_logo,
    p.company_domain,
    p.company_city,
    p.company_state_region,
    p.company_country,
    p.company_latitude,
    p.company_longitude,
    p.primary_specialty,
    p.primary_service_name,
    p.services_offered,
    p.display_rating,
    p.total_reviews,
    p.hourly_rate_display,
    p.is_verified,
    p.specialty_ids,
    p.specialty_parent_ids,
    p.cover_photo_url,
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
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
