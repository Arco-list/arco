-- Migration: Remove unnecessary views
-- Description: Clean up unnecessary view abstraction layer over materialized views

-- =============================================================================
-- REMOVE UNNECESSARY VIEWS
-- =============================================================================

-- Drop the unnecessary views that add no performance benefit
-- These views were just selecting from materialized views, adding overhead

DROP VIEW IF EXISTS public.v_professional_cards;
DROP VIEW IF EXISTS public.v_project_cards;

-- Add comment explaining the removal
COMMENT ON MATERIALIZED VIEW public.mv_professional_summary IS
'Optimized professional data for listings and search. Query this directly for UI components instead of using views.';

COMMENT ON MATERIALIZED VIEW public.mv_project_summary IS
'Optimized project data for listings and search. Query this directly for UI components instead of using views.';

-- =============================================================================
-- VERIFICATION QUERY (Optional - for confirmation)
-- =============================================================================

-- You can run this after the migration to confirm the views are gone:
-- SELECT table_name, table_type
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND (table_name LIKE '%_cards' OR table_name LIKE 'mv_%')
-- ORDER BY table_type, table_name;