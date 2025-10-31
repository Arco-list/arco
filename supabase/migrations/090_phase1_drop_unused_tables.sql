-- ============================================================================
-- Migration 090: Phase 1 - Drop Unused Tables
-- ============================================================================
-- Description: Remove tables that were never implemented and have no active code dependencies
-- Risk Level: LOW - Tables have no code references except TypeScript types
-- Estimated Time: < 1 minute
-- Part of: Database Refactoring Plan (REFACTORING_PLAN.md)
--
-- ⚠️  ISSUE ENCOUNTERED:
-- The CASCADE clause on DROP TABLE project_applications inadvertently dropped
-- mv_project_summary materialized view, which referenced the table in a LEFT JOIN.
-- This was fixed by migration 091 which recreates mv_project_summary without
-- the project_applications reference.
--
-- LESSON LEARNED: Always check materialized view dependencies before using CASCADE.
-- Consider using RESTRICT and manually handling dependencies.
-- ============================================================================

-- PART 1: DROP project_applications TABLE
-- Purpose: Was intended for professional application workflow but never implemented
-- Dependencies: NONE - Only exists in TypeScript types, never queried in application code
-- Data: 0 rows
-- Foreign Keys: Referenced by messages.application_id (cascade will handle)

DROP TABLE IF EXISTS public.project_applications CASCADE;

COMMENT ON SCHEMA public IS 'Phase 1: Dropped project_applications - feature never implemented';


-- ============================================================================
-- PART 2: DROP notifications TABLE
-- ============================================================================
-- Purpose: Was intended for system notifications but never implemented
-- Dependencies:
--   - app/admin/projects/actions.ts:378 (comment/warning text only - not a query)
--   - components/faq12.tsx:74 (marketing copy - will be updated)
-- Data: 0 rows
-- Foreign Keys: None currently active

DROP TABLE IF EXISTS public.notifications CASCADE;

COMMENT ON SCHEMA public IS 'Phase 1: Dropped notifications - feature never implemented';


-- ============================================================================
-- PART 3: DROP saved_professionals TABLE
-- ============================================================================
-- Purpose: Replaced by saved_companies table (migration 056)
-- Dependencies:
--   - app/admin/users/actions.ts:527 (counting for user deletion - will be removed)
--   - Context already migrated to saved_companies in contexts/saved-professionals-context.tsx
-- Data: 1 row (minimal impact)
-- Migration Path: Users already using saved_companies table

-- Drop RLS policies first
DROP POLICY IF EXISTS "Users can view own saved professionals" ON public.saved_professionals;
DROP POLICY IF EXISTS "Users can insert own saved professionals" ON public.saved_professionals;
DROP POLICY IF EXISTS "Users can delete own saved professionals" ON public.saved_professionals;
DROP POLICY IF EXISTS "Users can update own saved professionals" ON public.saved_professionals;

-- Drop foreign key constraints
ALTER TABLE IF EXISTS public.saved_professionals
  DROP CONSTRAINT IF EXISTS saved_professionals_professional_id_fkey CASCADE;

ALTER TABLE IF EXISTS public.saved_professionals
  DROP CONSTRAINT IF EXISTS saved_professionals_user_id_fkey CASCADE;

-- Drop the table
DROP TABLE IF EXISTS public.saved_professionals CASCADE;

COMMENT ON SCHEMA public IS 'Phase 1: Dropped saved_professionals - replaced by saved_companies';


-- ============================================================================
-- VERIFICATION QUERIES (for manual testing)
-- ============================================================================
-- Run these after migration to verify success:

-- 1. Verify tables no longer exist
-- SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('project_applications', 'notifications', 'saved_professionals');
-- Expected: 0 rows

-- 2. Verify saved_companies still exists and has data
-- SELECT COUNT(*) FROM public.saved_companies;
-- Expected: > 0 rows

-- 3. Check for any remaining foreign key references
-- SELECT conname, conrelid::regclass, confrelid::regclass
-- FROM pg_constraint
-- WHERE confrelid::regclass::text IN ('project_applications', 'notifications', 'saved_professionals');
-- Expected: 0 rows


-- ============================================================================
-- POST-MIGRATION TASKS
-- ============================================================================
-- After applying this migration:
--
-- 1. Code Changes Required:
--    ✅ Remove line 527 from app/admin/users/actions.ts
--       (Remove saved_professionals count in user deletion check)
--
--    ✅ Update components/faq12.tsx line 74
--       (Remove mention of notifications in FAQ answer)
--
-- 2. TypeScript Types:
--    ✅ Regenerate types: mcp__supabase__generate_typescript_types
--
-- 3. Testing:
--    ✅ Verify admin user deletion still works
--    ✅ Verify saved companies feature works
--    ✅ Check for any TypeScript compilation errors
--    ✅ Monitor application logs for foreign key errors
--
-- 4. Documentation:
--    ✅ Mark Phase 1 complete in REFACTORING_PLAN.md
--
-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- Tables can be recreated from original migrations:
-- - supabase/migrations/004_create_projects_and_photos.sql (project_applications)
-- - supabase/migrations/006_create_user_interactions.sql (notifications, saved_professionals)
--
-- However, this should NOT be necessary as:
-- - No features depend on these tables
-- - No data will be lost (0 rows in project_applications and notifications)
-- - saved_professionals has 1 row which is already in saved_companies
