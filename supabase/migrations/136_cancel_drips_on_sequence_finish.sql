-- ═══════════════════════════════════════════════════════════════════════
-- 136: Cancel drips when prospect sequence finishes
-- ═══════════════════════════════════════════════════════════════════════
-- Migration 134's trigger only watched prospects.status, so a prospect
-- whose sequence_status flips to 'finished' (via the admin "Finish
-- sequence" button or auto-finish on conversion) didn't have its pending
-- drip rows cancelled. Symptom: Taanbaas shows "Sequence finished" in
-- the UI but the queue still has prospect-followup queued for Apr 17.
--
-- Two changes:
--
-- 1. Trigger on prospects.sequence_status. When the column transitions
--    to 'finished', cancel all pending drip rows for the linked company
--    with reason 'manual' (since the admin's Finish action is the only
--    direct path that flips this column today; auto-conversion paths go
--    through prospects.status which migration 134 already handles with
--    reason 'status_change').
--
-- 2. Trigger on email_drip_queue INSERT. If a row is enqueued for a
--    company whose prospect is already at signup/company/active OR whose
--    sequence_status is finished/paused, cancel it immediately. Closes
--    the gap migration 135's backfill exposed: rows inserted directly
--    bypass the prospects.status trigger entirely, so we need the queue
--    side to enforce the same invariant.
--
-- Backfill at the bottom: same idempotent UPDATE that the trigger would
-- run, applied to existing rows in the bad state (Taanbaas + anyone
-- else who slipped through).
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Cancel drips when sequence_status flips to finished ─────────────

CREATE OR REPLACE FUNCTION public.cancel_drips_on_sequence_finish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.sequence_status IS NOT DISTINCT FROM OLD.sequence_status THEN
    RETURN NEW;
  END IF;

  IF NEW.sequence_status = 'finished' AND NEW.company_id IS NOT NULL THEN
    UPDATE public.email_drip_queue
       SET cancelled_at = now(),
           cancelled_reason = COALESCE(cancelled_reason, 'manual')
     WHERE company_id = NEW.company_id
       AND sent_at IS NULL
       AND cancelled_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.cancel_drips_on_sequence_finish() IS
  'When a prospect''s sequence_status flips to ''finished'' (admin Finish button), cancel pending drip rows for the linked company. Uses reason ''manual'' since this trigger is only reached via the explicit admin action — auto-conversion paths flip prospects.status first and are handled by trigger 134 with reason ''status_change''.';

DROP TRIGGER IF EXISTS trg_cancel_drips_on_sequence_finish ON public.prospects;
CREATE TRIGGER trg_cancel_drips_on_sequence_finish
  AFTER UPDATE OF sequence_status ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.cancel_drips_on_sequence_finish();

-- ─── 2. Cancel new drips inserted for an already-converted prospect ─────

CREATE OR REPLACE FUNCTION public.cancel_drip_if_prospect_advanced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prospect_status_text text;
  prospect_seq_status_text text;
BEGIN
  -- Only consider prospect-series rows linked to a company. Homeowner
  -- drips don't have company_id and don't go through this gate.
  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status::text, sequence_status::text
    INTO prospect_status_text, prospect_seq_status_text
  FROM public.prospects
  WHERE company_id = NEW.company_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF prospect_status_text IN ('signup', 'company', 'active') THEN
    NEW.cancelled_at := now();
    NEW.cancelled_reason := 'status_change';
  ELSIF prospect_seq_status_text = 'finished' THEN
    NEW.cancelled_at := now();
    NEW.cancelled_reason := 'manual';
  ELSIF prospect_seq_status_text = 'paused' THEN
    NEW.cancelled_at := now();
    NEW.cancelled_reason := 'paused';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.cancel_drip_if_prospect_advanced() IS
  'BEFORE INSERT guard on email_drip_queue: if the linked prospect is already at signup/company/active or its sequence is finished/paused, mark the new row cancelled at insert time. Closes the gap where direct inserts (e.g. backfills, future enqueues) bypass the prospects.status trigger.';

DROP TRIGGER IF EXISTS trg_cancel_drip_if_prospect_advanced ON public.email_drip_queue;
CREATE TRIGGER trg_cancel_drip_if_prospect_advanced
  BEFORE INSERT ON public.email_drip_queue
  FOR EACH ROW EXECUTE FUNCTION public.cancel_drip_if_prospect_advanced();

-- ─── 3. Backfill: cancel pending rows for already-finished sequences ────
-- Idempotent — only touches rows that are still pending. Covers Taanbaas
-- and any other prospect whose sequence is paused/finished or whose
-- prospect status has already advanced.

UPDATE public.email_drip_queue q
   SET cancelled_at = now(),
       cancelled_reason = CASE
         WHEN p.status::text IN ('signup', 'company', 'active') THEN 'status_change'
         WHEN p.sequence_status::text = 'finished' THEN 'manual'
         WHEN p.sequence_status::text = 'paused' THEN 'paused'
         ELSE 'manual'
       END
  FROM public.prospects p
 WHERE q.company_id = p.company_id
   AND q.sent_at IS NULL
   AND q.cancelled_at IS NULL
   AND (
     p.status::text IN ('signup', 'company', 'active')
     OR p.sequence_status::text IN ('finished', 'paused')
   );
