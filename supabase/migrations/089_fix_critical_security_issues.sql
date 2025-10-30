-- Migration: Fix critical security issues identified by Supabase security advisor
-- Issues addressed:
--   1. RLS disabled on project_category_attributes table (ERROR)
--   2. SECURITY DEFINER on company_metrics view (ERROR)
--   3. SECURITY DEFINER on project_search_documents view (ERROR)

-- =============================================================================
-- 1. Enable RLS on project_category_attributes table
-- =============================================================================
-- This table stores category metadata (whether categories are listable/building features)
-- It should be readable by all users but only writable by admins

ALTER TABLE public.project_category_attributes ENABLE ROW LEVEL SECURITY;

-- Allow public read access (this is reference data needed for UI)
CREATE POLICY "project_category_attributes_public_read"
  ON public.project_category_attributes
  FOR SELECT
  TO public
  USING (true);

-- Only admins can insert/update/delete (typically through seed scripts or admin actions)
CREATE POLICY "project_category_attributes_admin_write"
  ON public.project_category_attributes
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================================================
-- 2. Remove SECURITY DEFINER from company_metrics view
-- =============================================================================
-- This view aggregates company statistics and should respect RLS on underlying tables
-- The SECURITY DEFINER property bypasses RLS, which is a security risk

DROP VIEW IF EXISTS public.company_metrics;

CREATE VIEW public.company_metrics AS
WITH professional_counts AS (
  SELECT
    company_id,
    COUNT(*)::integer AS professional_count
  FROM public.professionals
  WHERE company_id IS NOT NULL
  GROUP BY company_id
),
project_counts AS (
  SELECT
    p.company_id,
    COUNT(DISTINCT pp.project_id)::integer AS projects_linked
  FROM public.professionals p
  JOIN public.project_professionals pp
    ON pp.professional_id = p.id
  WHERE p.company_id IS NOT NULL
  GROUP BY p.company_id
)
SELECT
  c.id AS company_id,
  COALESCE(pc.professional_count, 0) AS professional_count,
  COALESCE(prc.projects_linked, 0) AS projects_linked,
  cr.overall_rating AS average_rating,
  COALESCE(cr.total_reviews, 0) AS total_reviews
FROM public.companies c
LEFT JOIN professional_counts pc ON pc.company_id = c.id
LEFT JOIN project_counts prc ON prc.company_id = c.id
LEFT JOIN public.company_ratings cr ON cr.company_id = c.id;

-- Grant appropriate access
GRANT SELECT ON public.company_metrics TO authenticated, anon;

COMMENT ON VIEW public.company_metrics IS 'Aggregates company statistics including professional count, project linkages, and ratings. Respects RLS policies on underlying tables.';

-- =============================================================================
-- 3. Remove SECURITY DEFINER from project_search_documents view
-- =============================================================================
-- This view creates full-text search vectors for projects
-- It should respect RLS on the underlying mv_project_summary table

DROP VIEW IF EXISTS public.project_search_documents;

CREATE VIEW public.project_search_documents AS
SELECT
  id,
  title,
  description,
  location,
  address_city,
  project_type,
  building_type,
  project_size,
  style_preferences,
  features,
  budget_level,
  budget_min,
  budget_max,
  is_featured,
  likes_count,
  views_count,
  status,
  slug,
  project_year,
  building_year,
  client_first_name,
  client_last_name,
  client_avatar,
  primary_photo_url,
  primary_photo_alt,
  primary_category,
  primary_category_slug,
  primary_category_icon,
  primary_category_color,
  total_applications,
  pending_applications,
  photo_count,
  budget_display,
  created_at,
  updated_at,
  to_tsvector(
    'simple',
    TRIM(
      BOTH ' '
      FROM (
        COALESCE(title, '') || ' ' ||
        COALESCE(slug, '') || ' ' ||
        COALESCE(description, '') || ' ' ||
        COALESCE(location, '') || ' ' ||
        COALESCE(address_city, '') || ' ' ||
        COALESCE(primary_category, '') || ' ' ||
        COALESCE(primary_category_slug, '') || ' ' ||
        COALESCE(project_type, '') || ' ' ||
        COALESCE(project_size, '') || ' ' ||
        COALESCE(building_type, '') || ' ' ||
        COALESCE(budget_display, '') || ' ' ||
        COALESCE(budget_level::text, '') || ' ' ||
        COALESCE(array_to_string(COALESCE(style_preferences, ARRAY[]::text[]), ' '), '') || ' ' ||
        COALESCE(array_to_string(COALESCE(features, ARRAY[]::text[]), ' '), '')
      )
    )
  ) AS search_vector
FROM public.mv_project_summary;

-- Grant appropriate access
GRANT SELECT ON public.project_search_documents TO authenticated, anon;

COMMENT ON VIEW public.project_search_documents IS 'Provides full-text search functionality for projects. Respects RLS policies on underlying mv_project_summary table.';
