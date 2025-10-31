-- ============================================================================
-- Migration 093: HOTFIX - Recreate search_documents views
-- ============================================================================
-- Description: Recreate project_search_documents and professional_search_documents
-- Issue: Migration 090 CASCADE dropped these views when mv_project_summary
--        and mv_professional_summary were removed
-- Fix: Recreate both views (from migration 042)
-- ============================================================================

-- Drop if exists (clean slate)
DROP VIEW IF EXISTS public.project_search_documents CASCADE;
DROP VIEW IF EXISTS public.professional_search_documents CASCADE;

-- Recreate project_search_documents
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

-- Recreate professional_search_documents
CREATE VIEW public.professional_search_documents AS
SELECT
  p.*,
  to_tsvector(
    'simple',
    trim(
      both ' '
      FROM (
        COALESCE(p.company_name, '') || ' ' ||
        COALESCE(p.title, '') || ' ' ||
        COALESCE(p.bio, '') || ' ' ||
        COALESCE(p.user_location, '') || ' ' ||
        COALESCE(p.primary_specialty, '') || ' ' ||
        COALESCE(p.primary_specialty_slug, '') || ' ' ||
        COALESCE(p.first_name, '') || ' ' ||
        COALESCE(p.last_name, '') || ' ' ||
        COALESCE(array_to_string(COALESCE(p.services_offered, ARRAY[]::text[]), ' '), '') || ' ' ||
        COALESCE(array_to_string(COALESCE(p.languages_spoken, ARRAY[]::text[]), ' '), '')
      )
    )
  ) AS search_vector
FROM public.mv_professional_summary p;

-- Grant permissions
GRANT SELECT ON public.project_search_documents TO anon;
GRANT SELECT ON public.project_search_documents TO authenticated;
GRANT SELECT ON public.professional_search_documents TO anon;
GRANT SELECT ON public.professional_search_documents TO authenticated;

-- Add comments
COMMENT ON VIEW public.project_search_documents IS
  'Search-optimized view of projects with full-text search vectors - recreated after CASCADE drop in migration 090';

COMMENT ON VIEW public.professional_search_documents IS
  'Search-optimized view of professionals with full-text search vectors - recreated after CASCADE drop in migration 090';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After applying, verify with:
-- SELECT COUNT(*) FROM public.project_search_documents;
-- SELECT COUNT(*) FROM public.professional_search_documents;
-- ============================================================================
