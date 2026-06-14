-- Retire the 'unclaimed' company_status (data layer) and drop the empty
-- professional_specialties table.
--
-- 'unclaimed' is being collapsed into 'added' as the catch-all bucket.
-- 8 companies currently carry status='unclaimed' — backfilled to 'added'.
--
-- The 'unclaimed' enum value itself is left in place: Postgres doesn't
-- support DROP VALUE on an enum, and removing it via swap-and-rename
-- requires dropping every view/MV/trigger/function that references
-- companies.status (mv_project_summary, the sync_prospects trigger, etc).
-- That's broader than the benefit warrants. Treat the value as deprecated:
-- no new code should write it, and we can remove it later as part of a
-- broader cleanup of the company_status enum.
--
-- professional_specialties is empty and the only code reference is a
-- comment after the detail-page cutover in migration 174. Safe to drop.

UPDATE public.companies
SET status = 'added'::company_status
WHERE status = 'unclaimed';

DROP TABLE IF EXISTS public.professional_specialties;
