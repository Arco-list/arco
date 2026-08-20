-- Featured (default) professional sort: clicks over recency.
-- Mirrors the project ordering (lib/projects/sort.ts): starred tier →
-- credits → most clicks. views_count now breaks ties on the 'featured'
-- sort (it previously only applied to 'popular'); created_at stays as the
-- final deterministic tiebreak only. Otherwise identical to the
-- definition from 175_remove_plan_tier.

CREATE OR REPLACE FUNCTION public.search_professionals(
  search_query text DEFAULT NULL,
  country_filter text DEFAULT NULL,
  state_filter text DEFAULT NULL,
  city_filters text[] DEFAULT NULL,
  category_filters uuid[] DEFAULT NULL,
  service_filters uuid[] DEFAULT NULL,
  max_hourly_rate numeric DEFAULT NULL,
  verified_only boolean DEFAULT false,
  limit_count integer DEFAULT 20,
  offset_count integer DEFAULT 0,
  sort_by text DEFAULT 'most_relevant'
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  first_name text,
  last_name text,
  company_id uuid,
  company_name text,
  company_slug text,
  company_logo text,
  company_domain text,
  company_city text,
  company_state_region text,
  company_country text,
  company_latitude double precision,
  company_longitude double precision,
  primary_specialty text,
  primary_service_name text,
  services_offered text[],
  is_verified boolean,
  specialty_ids uuid[],
  specialty_parent_ids uuid[],
  cover_photo_url text,
  credited_sum integer,
  views_count integer,
  is_featured boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH project_credits AS (
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
    p.id, p.user_id, p.first_name, p.last_name,
    p.company_id, p.company_name, p.company_slug, p.company_logo, p.company_domain,
    p.company_city, p.company_state_region, p.company_country,
    p.company_latitude, p.company_longitude,
    p.primary_specialty, p.primary_service_name, p.services_offered,
    p.is_verified,
    p.specialty_ids, p.specialty_parent_ids, p.cover_photo_url,
    COALESCE(cc.credited_sum, 0)::int AS credited_sum,
    COALESCE(c.views_count, 0)::int AS views_count,
    COALESCE(c.is_featured, FALSE) AS is_featured
  FROM public.mv_professional_summary p
  LEFT JOIN public.companies c ON c.id = p.company_id
  LEFT JOIN company_credits cc ON cc.company_id = p.company_id
  WHERE
    p.company_status IN ('listed', 'prospected')
    AND (NOT verified_only OR p.is_verified = TRUE)
    AND (search_query IS NULL OR (
      p.first_name ILIKE '%' || search_query || '%'
      OR p.last_name ILIKE '%' || search_query || '%'
      OR p.primary_specialty ILIKE '%' || search_query || '%'
      OR p.primary_service_name ILIKE '%' || search_query || '%'
      OR p.primary_service_name_nl ILIKE '%' || search_query || '%'
      OR p.company_name ILIKE '%' || search_query || '%'
      OR p.company_city ILIKE '%' || search_query || '%'
      OR p.company_state_region ILIKE '%' || search_query || '%'
      OR (p.services_offered IS NOT NULL AND EXISTS (
        SELECT 1 FROM unnest(p.services_offered) service
        WHERE service ILIKE '%' || search_query || '%'))))
    AND (country_filter IS NULL OR p.searchable_country = lower(trim(country_filter)))
    AND (state_filter IS NULL OR p.searchable_state_region = lower(trim(state_filter)))
    AND (city_filters IS NULL OR array_length(city_filters, 1) IS NULL
         OR p.searchable_city = ANY(SELECT lower(trim(cf)) FROM unnest(city_filters) cf))
    AND (category_filters IS NULL OR array_length(category_filters, 1) IS NULL
         OR p.specialty_parent_ids && category_filters)
    AND (service_filters IS NULL OR array_length(service_filters, 1) IS NULL
         OR p.specialty_ids && service_filters)
  ORDER BY
    (CASE WHEN sort_by = 'featured' AND COALESCE(c.is_featured, FALSE) THEN 0 ELSE 1 END),
    (CASE WHEN sort_by IN ('most_relevant', 'featured') THEN -COALESCE(cc.credited_sum, 0) ELSE 0 END),
    (CASE WHEN sort_by IN ('popular', 'featured') THEN -COALESCE(c.views_count, 0) ELSE 0 END),
    p.created_at DESC
  LIMIT limit_count OFFSET offset_count;
END;
$function$;
