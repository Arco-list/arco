-- 163_companies_listed_seo_indexed_at.sql
--
-- Mirrors 162's onboarded_at pattern for two more transition metrics
-- that previously bucketed by companies.updated_at and suffered the
-- same "admin edits move the date" bug:
--
--   listed_at      — stamped when status first becomes 'listed'.
--                    Feeds the Growth Model's "Listed Pros" series.
--   seo_indexed_at — stamped when seo_indexed first flips to true.
--                    Feeds the "Companies ranked" sub.
--
-- Both are idempotent: re-listing a previously unlisted pro doesn't
-- overwrite listed_at, and re-indexing doesn't overwrite
-- seo_indexed_at. The "first time it happened" semantic is what we
-- want for acquisition-style flow metrics.
--
-- Unlisted is intentionally NOT given a column — the "Unlisted pros"
-- row is a snapshot count (currently-unlisted, no bucketing flow), so
-- it doesn't need a transition timestamp.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS listed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seo_indexed_at TIMESTAMPTZ;

-- Backfill listed_at for currently-listed pros using the same
-- LEAST(created_at, updated_at) proxy as onboarded_at — for pros that
-- onboarded directly to 'listed' the two timestamps will match,
-- which is correct.
UPDATE public.companies
   SET listed_at = LEAST(created_at, updated_at)
 WHERE status = 'listed'
   AND owner_id IS NOT NULL
   AND listed_at IS NULL;

-- Backfill seo_indexed_at for currently-indexed pros. Same proxy.
UPDATE public.companies
   SET seo_indexed_at = LEAST(created_at, updated_at)
 WHERE seo_indexed = true
   AND seo_indexed_at IS NULL;

-- Extend the existing onboarded_at trigger to also stamp listed_at on
-- the first transition INTO 'listed' from any state.
CREATE OR REPLACE FUNCTION public.set_company_onboarded_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (OLD.status = 'draft' AND NEW.status <> 'draft' AND NEW.onboarded_at IS NULL) THEN
    NEW.onboarded_at := now();
  END IF;
  IF (OLD.status <> 'listed' AND NEW.status = 'listed' AND NEW.listed_at IS NULL) THEN
    NEW.listed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

-- The existing trigger only fires on UPDATE OF status, which is fine
-- for listed_at too. seo_indexed flips on a different column, so it
-- gets its own trigger.
CREATE OR REPLACE FUNCTION public.set_company_seo_indexed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF ((OLD.seo_indexed IS DISTINCT FROM true) AND NEW.seo_indexed = true AND NEW.seo_indexed_at IS NULL) THEN
    NEW.seo_indexed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_company_seo_indexed_at ON public.companies;
CREATE TRIGGER trg_set_company_seo_indexed_at
  BEFORE UPDATE OF seo_indexed ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_seo_indexed_at();

CREATE INDEX IF NOT EXISTS idx_companies_listed_at
  ON public.companies (listed_at);
CREATE INDEX IF NOT EXISTS idx_companies_seo_indexed_at
  ON public.companies (seo_indexed_at);
