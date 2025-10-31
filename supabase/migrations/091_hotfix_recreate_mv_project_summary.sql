-- ============================================================================
-- Migration 091: HOTFIX - Recreate mv_project_summary
-- ============================================================================
-- Description: Recreate mv_project_summary after it was accidentally dropped
--              by CASCADE when dropping project_applications table
-- Issue: Migration 090 dropped project_applications with CASCADE, which removed
--        mv_project_summary because it referenced that table
-- Fix: Recreate mv_project_summary WITHOUT the project_applications reference
-- ============================================================================

-- Drop if exists (in case of partial state)
DROP MATERIALIZED VIEW IF EXISTS public.mv_project_summary CASCADE;

-- Recreate mv_project_summary WITHOUT project_applications reference
CREATE MATERIALIZED VIEW public.mv_project_summary AS
SELECT
  p.id,
  p.title,
  p.description,
  p.location,
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

  -- Client information
  prof.first_name as client_first_name,
  prof.last_name as client_last_name,
  prof.avatar_url as client_avatar,

  -- Primary photo
  pp.url as primary_photo_url,
  pp.alt_text as primary_photo_alt,

  -- Category information (primary category)
  cat.name as primary_category,
  cat.slug as primary_category_slug,
  cat.icon as primary_category_icon,
  cat.color as primary_category_color,

  -- Photo count
  COALESCE(photo_stats.photo_count, 0) as photo_count,

  -- Display fields
  CASE
    WHEN p.budget_min IS NOT NULL AND p.budget_max IS NOT NULL
    THEN p.budget_min || ' - ' || p.budget_max || ' EUR'
    WHEN p.budget_level IS NOT NULL
    THEN INITCAP(REPLACE(p.budget_level::text, '_', ' '))
    ELSE 'Budget not specified'
  END as budget_display,

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
    COUNT(*) as photo_count
  FROM public.project_photos
  GROUP BY project_id
) photo_stats ON p.id = photo_stats.project_id

WHERE p.status = 'published' AND prof.is_active = TRUE;

-- Create indexes on project summary materialized view
CREATE UNIQUE INDEX idx_mv_project_summary_id ON public.mv_project_summary(id);
CREATE INDEX idx_mv_project_summary_location ON public.mv_project_summary(location);
CREATE INDEX idx_mv_project_summary_featured ON public.mv_project_summary(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_mv_project_summary_budget ON public.mv_project_summary(budget_level);
CREATE INDEX idx_mv_project_summary_type ON public.mv_project_summary(project_type);
CREATE INDEX idx_mv_project_summary_category ON public.mv_project_summary(primary_category);
CREATE INDEX idx_mv_project_summary_created ON public.mv_project_summary(created_at DESC);
CREATE INDEX idx_mv_project_summary_likes ON public.mv_project_summary(likes_count DESC);

-- Full-text search index on project summary
CREATE INDEX idx_mv_project_summary_search ON public.mv_project_summary
  USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Add comment
COMMENT ON MATERIALIZED VIEW public.mv_project_summary IS 'Optimized project data for listings and search - recreated without project_applications reference';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After applying, verify with:
-- SELECT COUNT(*) FROM public.mv_project_summary;
-- ============================================================================
