-- When a prospect's status advances to 'visitor' (they landed on the
-- claim page), seed prospects.next_follow_up_at to now() so the row
-- immediately enters the admin/sales "Outbound due" cohort. Reps see
-- the company surface in the toolbar count and the header badge the
-- moment the lead is hot — no manual triage needed.
--
-- Idempotent: only writes when next_follow_up_at IS NULL, so we never
-- overwrite a rep's manually-scheduled follow-up. AFTER UPDATE of
-- status only, so re-saves with the same status don't re-trigger the
-- write (matches the trg_cancel_drips_on_prospect_advance pattern).

CREATE OR REPLACE FUNCTION public.set_next_follow_up_on_visitor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'visitor' AND NEW.next_follow_up_at IS NULL THEN
    NEW.next_follow_up_at := now();
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_next_follow_up_on_visitor() IS
  'When prospect.status moves to visitor, seed next_follow_up_at = now() so the row enters the Outbound-due cohort. Only writes when next_follow_up_at IS NULL — never overrides a manual follow-up.';

DROP TRIGGER IF EXISTS trg_set_next_follow_up_on_visitor ON public.prospects;
CREATE TRIGGER trg_set_next_follow_up_on_visitor
  BEFORE INSERT OR UPDATE OF status ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.set_next_follow_up_on_visitor();

-- Backfill: any prospect already at visitor with no follow-up set should
-- be due now so the cohort is correct on day 1.
UPDATE public.prospects
   SET next_follow_up_at = now()
 WHERE status = 'visitor'
   AND next_follow_up_at IS NULL;
