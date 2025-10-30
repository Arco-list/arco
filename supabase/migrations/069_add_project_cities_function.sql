-- Migration: Add project cities function and update materialized view
-- Description: Adds address_city to mv_project_summary and creates function to get distinct cities

-- Drop dependent view first
DROP VIEW IF EXISTS public.project_search_documents;

-- Drop and recreate materialized view with address_city column
DROP MATERIALIZED VIEW IF EXISTS public.mv_project_summary;

CREATE MATERIALIZED VIEW public.mv_project_summary AS
SELECT
  p.id,
  p.title,
  p.description,
  p.location,
  p.address_city,
  p.project_type,
  p.building_type,
  p.project_size,
  p.style_preferences,
  p.features,
  p.budget_level,
  p.budget_min,
  p.budget_max,
  p.is_featured,
  p.likes_count,
  p.views_count,
  p.status,
  p.slug,
  p.project_year,
  p.building_year,
  prof.first_name AS client_first_name,
  prof.last_name AS client_last_name,
  prof.avatar_url AS client_avatar,
  pp.url AS primary_photo_url,
  pp.alt_text AS primary_photo_alt,
  cat.name AS primary_category,
  cat.slug AS primary_category_slug,
  cat.icon AS primary_category_icon,
  cat.color AS primary_category_color,
  COALESCE(app_stats.total_applications, 0) AS total_applications,
  COALESCE(app_stats.pending_applications, 0) AS pending_applications,
  COALESCE(photo_stats.photo_count, 0) AS photo_count,
  CASE
    WHEN p.budget_min IS NOT NULL AND p.budget_max IS NOT NULL THEN p.budget_min || ' - ' || p.budget_max || ' EUR'
    WHEN p.budget_level IS NOT NULL THEN INITCAP(REPLACE(p.budget_level::text, '_', ' '))
    ELSE 'Budget not specified'
  END AS budget_display,
  p.created_at,
  p.updated_at
FROM public.projects p
JOIN public.profiles prof ON p.client_id = prof.id
LEFT JOIN public.project_photos pp ON p.id = pp.project_id AND pp.is_primary = TRUE
LEFT JOIN public.project_categories pc ON p.id = pc.project_id AND pc.is_primary = TRUE
LEFT JOIN public.categories cat ON pc.category_id = cat.id
LEFT JOIN (
  SELECT
    project_id,
    COUNT(*) AS total_applications,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_applications
  FROM public.project_applications
  GROUP BY project_id
) app_stats ON p.id = app_stats.project_id
LEFT JOIN (
  SELECT
    project_id,
    COUNT(*) AS photo_count
  FROM public.project_photos
  GROUP BY project_id
) photo_stats ON p.id = photo_stats.project_id
WHERE p.status IN ('published', 'completed')
  AND prof.is_active = TRUE;

-- Recreate indexes
CREATE UNIQUE INDEX idx_mv_project_summary_id ON public.mv_project_summary(id);
CREATE INDEX idx_mv_project_summary_location ON public.mv_project_summary(location);
CREATE INDEX idx_mv_project_summary_city ON public.mv_project_summary(address_city) WHERE address_city IS NOT NULL;
CREATE INDEX idx_mv_project_summary_featured ON public.mv_project_summary(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_mv_project_summary_budget ON public.mv_project_summary(budget_level);
CREATE INDEX idx_mv_project_summary_type ON public.mv_project_summary(project_type);
CREATE INDEX idx_mv_project_summary_category ON public.mv_project_summary(primary_category);
CREATE INDEX idx_mv_project_summary_created ON public.mv_project_summary(created_at DESC);
CREATE INDEX idx_mv_project_summary_likes ON public.mv_project_summary(likes_count DESC);
CREATE INDEX idx_mv_project_summary_search ON public.mv_project_summary
  USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

COMMENT ON MATERIALIZED VIEW public.mv_project_summary IS 'Optimized project data for listings and search - query directly for UI components';

-- Recreate dependent view
CREATE VIEW public.project_search_documents AS
SELECT
  p.*,
  to_tsvector(
    'simple',
    trim(
      both ' '
      FROM (
        COALESCE(p.title, '') || ' ' ||
        COALESCE(p.slug, '') || ' ' ||
        COALESCE(p.description, '') || ' ' ||
        COALESCE(p.location, '') || ' ' ||
        COALESCE(p.address_city, '') || ' ' ||
        COALESCE(p.primary_category, '') || ' ' ||
        COALESCE(p.primary_category_slug, '') || ' ' ||
        COALESCE(p.project_type, '') || ' ' ||
        COALESCE(p.project_size, '') || ' ' ||
        COALESCE(p.building_type, '') || ' ' ||
        COALESCE(p.budget_display, '') || ' ' ||
        COALESCE(p.budget_level::text, '') || ' ' ||
        COALESCE(array_to_string(COALESCE(p.style_preferences, ARRAY[]::text[]), ' '), '') || ' ' ||
        COALESCE(array_to_string(COALESCE(p.features, ARRAY[]::text[]), ' '), '')
      )
    )
  ) AS search_vector
FROM public.mv_project_summary p;

-- Create function to get distinct cities from published projects
CREATE OR REPLACE FUNCTION public.get_project_cities()
RETURNS TABLE(city TEXT) AS $$
  SELECT DISTINCT p.address_city
  FROM public.projects p
  WHERE p.address_city IS NOT NULL
    AND TRIM(p.address_city) != ''
    AND p.status IN ('published', 'completed')
  ORDER BY p.address_city;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_project_cities() IS 'Returns distinct cities from published and completed projects for location filter';

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.get_project_cities() TO authenticated, anon;
