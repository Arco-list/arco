-- Count function mirroring search_professionals WHERE clause
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
    p.company_status = 'listed'
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
    AND (
      city_filters IS NULL
      OR array_length(city_filters, 1) IS NULL
      OR p.searchable_city = ANY(
        SELECT lower(trim(cf)) FROM unnest(city_filters) cf
      )
    )
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
    );

  RETURN result;
END;
$function$;
