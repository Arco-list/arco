-- 162_companies_onboarded_at.sql
--
-- Records the moment a company "completed onboarding" — i.e. left the
-- 'draft' status for any non-draft state. The Growth Model's New Pros
-- metric was previously bucketed by companies.updated_at, which moves
-- on every admin edit and bunched recently-edited pros onto the
-- current bucket (most visible on the "days" view).
--
-- onboarded_at is set automatically by a trigger when status
-- transitions out of 'draft'. Historical rows are backfilled with
-- LEAST(created_at, updated_at) as the best available proxy.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- Backfill: companies that are currently non-draft and have an owner
-- (i.e. real pros, not abandoned drafts) get the earliest available
-- timestamp. For most pros the draft → listed transition happens
-- within days of creation, so LEAST(created_at, updated_at) is close
-- to the true onboarded moment. Companies still in draft, and
-- companies without an owner_id, remain NULL.
UPDATE public.companies
   SET onboarded_at = LEAST(created_at, updated_at)
 WHERE status <> 'draft'
   AND owner_id IS NOT NULL
   AND onboarded_at IS NULL;

-- Trigger: stamp onboarded_at on the first transition from 'draft' to
-- any other status. Idempotent — if onboarded_at is already set we
-- leave it alone so re-listing a previously-unlisted pro doesn't
-- overwrite the original onboard date.
CREATE OR REPLACE FUNCTION public.set_company_onboarded_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (OLD.status = 'draft' AND NEW.status <> 'draft' AND NEW.onboarded_at IS NULL) THEN
    NEW.onboarded_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_company_onboarded_at ON public.companies;
CREATE TRIGGER trg_set_company_onboarded_at
  BEFORE UPDATE OF status ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_onboarded_at();

-- Bucket queries scan by onboarded_at over a trailing window. Most
-- rows have a non-null value after the backfill, so a partial index
-- isn't worthwhile here — a plain b-tree keeps the planner happy.
CREATE INDEX IF NOT EXISTS idx_companies_onboarded_at
  ON public.companies (onboarded_at);
