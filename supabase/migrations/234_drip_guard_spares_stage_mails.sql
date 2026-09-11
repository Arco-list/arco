-- ═══════════════════════════════════════════════════════════════════════
-- 234: The drip-queue birth guard spares stage mails
-- ═══════════════════════════════════════════════════════════════════════
-- cancel_drip_if_prospect_advanced (BEFORE INSERT on email_drip_queue)
-- predates the lifecycle-mail model: it assumed every queue row was a
-- contacted-series drip, so once a prospect's sequence_status was
-- 'finished' it cancelled EVERY new row at birth (cancelled_at ==
-- created_at, reason 'manual'). That silently killed the stage mails
-- that are by design enqueued AFTER the contacted series ends: every
-- verified-reminder ever enqueued died on arrival (TMOJ, Steellife,
-- Buitenhuis Villabouw — all found born-cancelled on Sep 9 2026), and
-- visitor-nudges for finished-sequence prospects would go the same way.
-- Its status list also still named the pre-remodel enum values
-- ('signup', 'company') that no longer exist.
--
-- New shape:
--   * Stage mails (visitor-nudge, verified-reminder, and future stage
--     templates) pass through untouched — their lifecycle is owned by
--     the cron's stage-ceiling gate, checked at SEND time.
--   * The contacted-series templates (outreach-*, prospect-*,
--     new-professional-*) keep the birth-time guard, with the status
--     list on the current ladder: anything past 'contacted' means the
--     series no longer applies.

CREATE OR REPLACE FUNCTION public.cancel_drip_if_prospect_advanced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prospect_status_text text;
  prospect_seq_status_text text;
BEGIN
  -- Only the contacted-series drips get the birth guard; stage mails
  -- are enqueued BY promotions and manage their own stop conditions.
  IF NEW.template !~ '^(outreach|prospect|new-professional)-' THEN
    RETURN NEW;
  END IF;

  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status::text, sequence_status::text
    INTO prospect_status_text, prospect_seq_status_text
  FROM public.prospects
  WHERE company_id = NEW.company_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF prospect_status_text IN ('visitor', 'verified', 'owned', 'active') THEN
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
$function$;

-- Repair: revive the three verified-reminders the old guard killed at
-- birth (cancelled_at == created_at is the fingerprint). Each is the
-- only live reminder for its address; sends are in the future.
UPDATE email_drip_queue
   SET cancelled_at = NULL, cancelled_reason = NULL
 WHERE template = 'verified-reminder'
   AND cancelled_reason = 'manual'
   AND cancelled_at = created_at
   AND sent_at IS NULL
   AND id IN (
     '4e73d3c8-a353-46f2-9223-a2b465d313c3', -- j.sybenga@tmoj.nl
     '67235c5e-9087-41eb-af02-8ff836641196', -- verkoop@steellife.nl
     '0529a59e-8a26-40e0-90c6-da2e693a2db5'  -- info@buitenhuisvillabouw.nl
   );
