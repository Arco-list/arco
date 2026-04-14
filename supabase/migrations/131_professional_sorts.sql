-- ═══════════════════════════════════════════════════════════════════════
-- 131: Professional discover sorts
-- ═══════════════════════════════════════════════════════════════════════
-- Mirrors migration 130 (project sorts) for the /professionals grid:
--   • companies.views_count      — click counter for the Popular sort
--   • increment_company_views()  — SECURITY DEFINER RPC, called on detail
--                                   page render
--   • search_professionals()     — gains a sort_by parameter and two new
--                                   return columns (credited_sum,
--                                   views_count) so the four sort modes
--                                   run server-side, stable across pages.
--
-- "Most relevant" sorts by the total credited-professional count summed
-- across the company's linked projects — i.e. the more project-level
-- collaboration signal the company has, the higher it ranks. Computed
-- per-query in a CTE (<1ms at current scale; denormalize into a column
-- if project_professionals grows past ~100k rows).
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Popular sort signal ─────────────────────────────────────────────

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.companies.views_count IS
  'Raw count of /professionals/[slug] detail-page renders. Drives the Popular sort; PostHog carries the time-ranged event log separately.';

CREATE OR REPLACE FUNCTION public.increment_company_views(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.companies
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = p_company_id
    AND status = 'listed';
END;
$$;

REVOKE ALL ON FUNCTION public.increment_company_views(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_company_views(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.increment_company_views(uuid) IS
  'Bumps companies.views_count. Safe for anon (SECURITY DEFINER + listed-status guard). Called from TrackProfessionalView on the client.';

-- ─── 2. search_professionals with sort_by ───────────────────────────────

DROP FUNCTION IF EXISTS public.search_professionals(
  TEXT, TEXT, TEXT, TEXT[], UUID[], UUID[], DECIMAL, DECIMAL, BOOLEAN, INTEGER, INTEGER
);

CREATE FUNCTION public.search_professionals(
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
  company_latitude DOUBLE PRECISION,
  company_longitude DOUBLE PRECISION,
  primary_specialty TEXT,
  primary_service_name TEXT,
  services_offered TEXT[],
  display_rating DECIMAL,
  total_reviews INTEGER,
  hourly_rate_display TEXT,
  is_verified BOOLEAN,
  specialty_ids UUID[],
  specialty_parent_ids UUID[],
  cover_photo_url TEXT,
  credited_sum INTEGER,
  views_count INTEGER,
  is_featured BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Per-project credited count (active project_professionals rows)
  project_credits AS (
    SELECT project_id, count(*)::int AS credited
    FROM public.project_professionals
    WHERE status IN ('live_on_page', 'listed')
    GROUP BY project_id
  ),
  -- Per-company sum of credits across every project the company is on.
  -- "Not unique" semantics: if a project has 3 credited pros, all 3 get
  -- +3 toward their company's credited_sum for this link. A company that
  -- appears on 2 projects with 3 and 2 credits has a sum of 5.
  company_credits AS (
    SELECT pp.company_id, COALESCE(SUM(pc.credited), 0)::int AS credited_sum
    FROM public.project_professionals pp
    LEFT JOIN project_credits pc ON pc.project_id = pp.project_id
    WHERE pp.status IN ('live_on_page', 'listed')
      AND pp.company_id IS NOT NULL
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
    p.company_id,
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
  LEFT JOIN public.companies c ON c.id = p.company_id
  LEFT JOIN company_credits cc ON cc.company_id = p.company_id
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
    )
  ORDER BY
    -- Featured sort: starred companies first
    (CASE WHEN sort_by = 'featured' AND COALESCE(c.is_featured, FALSE) THEN 0 ELSE 1 END),
    -- Most relevant or Featured: credited sum DESC
    (CASE
       WHEN sort_by IN ('most_relevant', 'featured') THEN -COALESCE(cc.credited_sum, 0)
       ELSE 0
     END),
    -- Popular: views DESC
    (CASE
       WHEN sort_by = 'popular' THEN -COALESCE(c.views_count, 0)
       ELSE 0
     END),
    -- Most recent: created_at DESC (handled below too as final tiebreaker)
    p.created_at DESC
  LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.search_professionals(
  TEXT, TEXT, TEXT, TEXT[], UUID[], UUID[], DECIMAL, DECIMAL, BOOLEAN, INTEGER, INTEGER, TEXT
) TO anon, authenticated;

COMMENT ON FUNCTION public.search_professionals IS
  'Discover-grid source. sort_by accepts most_relevant | featured | popular | most_recent. Additive columns: credited_sum, views_count, is_featured — safe for existing clients.';
