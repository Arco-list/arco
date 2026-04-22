-- ═══════════════════════════════════════════════════════════════════════
-- 143: Track project publish date in its own column
-- ═══════════════════════════════════════════════════════════════════════
-- The /admin/growth Publishers metric used projects.updated_at as a
-- publish-date proxy. Any edit to a project bumps updated_at, so a bulk
-- SEO touch on Apr 21 made the dashboard claim 8 distinct companies
-- "published" that day when only 1 actually transitioned draft→published.
--
-- Fix: dedicated published_at column, set the first time status moves to
-- 'published'. Subsequent edits don't touch it. Existing published rows
-- are intentionally left NULL (Option A in the discussion):
--   - Backfilling to updated_at would reproduce the bug we're fixing.
--   - Backfilling to created_at understates publish time by however long
--     the project sat in draft.
--   Leaving NULL means historical Publishers buckets read 0 until a
--   project republishes, but everything from this migration forward is
--   trustworthy. Better one honest gap than ongoing false signal.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Partial index so the growth metric can scan only published rows.
CREATE INDEX IF NOT EXISTS idx_projects_published_at
  ON public.projects(published_at)
  WHERE status = 'published' AND published_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_project_published_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- First-time publish on insert (rare — projects almost always start as
  -- draft, but cover the case for completeness).
  IF TG_OP = 'INSERT'
     AND NEW.status = 'published'
     AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
    RETURN NEW;
  END IF;

  -- Status transition into 'published'. We only stamp once: if a project
  -- was unpublished and republished later, published_at keeps the
  -- original date. (Change later if a "last published" semantic is
  -- needed; for the Publishers metric, "first published" is what we
  -- want.)
  IF TG_OP = 'UPDATE'
     AND OLD.status IS DISTINCT FROM 'published'
     AND NEW.status = 'published'
     AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_project_published_at() IS
  'Stamps projects.published_at the first time a row enters status=published. Idempotent — does not overwrite an existing value.';

DROP TRIGGER IF EXISTS trg_set_project_published_at ON public.projects;
CREATE TRIGGER trg_set_project_published_at
  BEFORE INSERT OR UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_project_published_at();
