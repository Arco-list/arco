-- When did this prospect last move in the funnel?
--
-- The companies table got this in 269; the sales board needs the same
-- answer about contacts. Same reasoning: prospects.status has no
-- history, and updated_at is not a substitute — sync-platform-prospects
-- rewrites these rows every fifteen minutes, which is exactly how the
-- showcased companies all ended up reading as "changed today".
--
-- Unlike companies, the backfill here is mostly MEASURED rather than
-- guessed, because each funnel stage already has its own timestamp and
-- those are what move a prospect into that stage in the first place:
--
--   prospect   created_at          — never moved; this is exact
--   contacted  last_email_sent_at  — the mail IS the transition (1,098 of 1,100)
--   visitor    landing_visited_at  — the visit IS the transition (357 of 357)
--   active     converted_at        — (28 of 28)
--   owned }    signed_up_at, else landing_visited_at
--   verified }
--   unlisted   converted_at, else landing_visited_at
--   removed    not_interested_at, else updated_at — the only real guess
--
-- From here the trigger records it, so nothing after today is inferred.

ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz DEFAULT now();

COMMENT ON COLUMN public.prospects.status_changed_at IS
  'The last time status changed. Distinct from updated_at, which the platform-prospect sync moves every fifteen minutes. Defaulted on insert because a new prospect''s status takes effect the moment the row exists; stamped thereafter by trg_prospect_status_changed_at.';

CREATE OR REPLACE FUNCTION public.set_prospect_status_changed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF (NEW.status IS DISTINCT FROM OLD.status) THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prospect_status_changed_at ON public.prospects;
CREATE TRIGGER trg_prospect_status_changed_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_prospect_status_changed_at();

UPDATE public.prospects
   SET status_changed_at = COALESCE(
         CASE status::text
           WHEN 'prospect'  THEN created_at
           WHEN 'contacted' THEN last_email_sent_at
           WHEN 'visitor'   THEN landing_visited_at
           WHEN 'active'    THEN converted_at
           WHEN 'owned'     THEN COALESCE(signed_up_at, landing_visited_at)
           WHEN 'verified'  THEN COALESCE(signed_up_at, landing_visited_at)
           WHEN 'unlisted'  THEN COALESCE(converted_at, landing_visited_at)
           WHEN 'removed'   THEN COALESCE(not_interested_at, updated_at)
         END,
         updated_at,
         created_at
       );

CREATE INDEX IF NOT EXISTS prospects_status_changed_at_idx
  ON public.prospects (status_changed_at DESC NULLS LAST);
