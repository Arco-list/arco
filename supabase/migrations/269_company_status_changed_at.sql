-- When did this company last move in the funnel?
--
-- Nothing recorded it. companies.status is a single column with no
-- history, and the nearest thing — updated_at — answers a different
-- question: it moves on any write at all, including the SEO cron and
-- the Apollo sync. Migration 163 already named that trap when it added
-- listed_at, because bucketing on updated_at made an admin edit look
-- like a transition.
--
-- The timestamps we do have each record ONE transition: onboarded_at
-- for the first move out of 'created', listed_at for the first move
-- into 'listed'. Neither answers "the last move, whatever it was",
-- which is what an admin filtering by status and sorting by recency
-- actually wants.
--
-- So: one column, stamped on every status change by the trigger that
-- already watches this table for exactly these moments.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

-- Defaulted, because the trigger below is BEFORE UPDATE and a row that
-- has only ever been inserted has not "changed" anything. A company's
-- status takes effect the moment the row exists, so creation time is
-- when the current status started — and without this an import of
-- several thousand would arrive carrying NULL and read as "—", which is
-- emptier than the Created column this replaces.
ALTER TABLE public.companies
  ALTER COLUMN status_changed_at SET DEFAULT now();

COMMENT ON COLUMN public.companies.status_changed_at IS
  'The last time status changed, stamped by set_company_onboarded_at. Distinct from updated_at, which any write moves, and from listed_at / onboarded_at, which each record one specific first transition. Rows predating this column carry a backfill — see migration 269 — which is exact for the 3,006 companies still sitting at their import status and an approximation for the ~137 that had moved.';

-- Extend the existing BEFORE UPDATE trigger rather than adding another.
-- It already fires on precisely these writes, and two triggers racing
-- to stamp the same row is a problem nobody needs.
CREATE OR REPLACE FUNCTION public.set_company_onboarded_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  owner_source TEXT;
BEGIN
  IF (OLD.status = 'created' AND NEW.status <> 'created' AND NEW.onboarded_at IS NULL) THEN
    NEW.onboarded_at := now();
    IF NEW.owner_id IS NOT NULL AND NEW.first_touch_source IS NULL THEN
      SELECT first_touch_source INTO owner_source
        FROM public.profiles
       WHERE id = NEW.owner_id;
      IF owner_source IS NOT NULL THEN
        NEW.first_touch_source := owner_source;
      END IF;
    END IF;
  END IF;

  IF (OLD.status <> 'listed' AND NEW.status = 'listed' AND NEW.listed_at IS NULL) THEN
    NEW.listed_at := now();
  END IF;

  -- Every change, in both directions, overwritten each time. The other
  -- two stamps above are deliberately first-time-only and stay that way:
  -- they measure acquisition, this measures recency, and one column
  -- cannot do both.
  IF (NEW.status IS DISTINCT FROM OLD.status) THEN
    NEW.status_changed_at := now();
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill, best evidence first.
--
--   'added' is the status an import arrives at and never leaves, so
--   created_at is not a proxy there — it is the answer, for 3,006 of
--   the 3,172 rows.
--
--   A currently-listed company last moved when it was listed.
--
--   Everything else moved at a moment nothing wrote down. onboarded_at
--   is real where it exists; updated_at is a guess and is only reached
--   when there is nothing better.
UPDATE public.companies
   SET status_changed_at = CASE
         WHEN status::text = 'added'  THEN created_at
         WHEN status::text = 'listed' AND listed_at IS NOT NULL THEN listed_at
         ELSE COALESCE(onboarded_at, listed_at, updated_at, created_at)
       END
 WHERE status_changed_at IS NULL;

CREATE INDEX IF NOT EXISTS companies_status_changed_at_idx
  ON public.companies (status_changed_at DESC NULLS LAST);
