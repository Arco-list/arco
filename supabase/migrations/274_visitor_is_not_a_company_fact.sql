-- A visitor is one person who clicked, not a firm that converted.
--
-- Migration 273 widened the drip birth guard from "the newest contact
-- at this company" to "ANY contact", because with one sequence per
-- contact the arbitrary newest row was the wrong thing to read. That
-- was right for three of the four statuses it checks and wrong for the
-- fourth, and the wrong one bites immediately:
--
--   Wolterinck has two colleagues at 'visitor' — they clicked a claim
--   link, neither claimed. A third contact added by hand at 14:26 had
--   all three of her drip rows cancelled in the same microsecond they
--   were written, reason 'status_change'. Dead at birth, with the
--   sequence still reading Active.
--
-- WHICH STATUSES ARE FACTS ABOUT THE FIRM:
--
--   active / owned / verified — somebody claimed the page, or is in
--     the middle of claiming it. The page has an owner or is about to.
--     Sending anyone else there "claim your page" is wrong, so these
--     stay company-wide.
--
--   visitor — one person opened a link. That is a fact about THAT
--     person: it says they are engaged, not that the firm is handled.
--     Mailing a colleague is exactly what an admin adding a contact is
--     trying to do, and the whole point of one sequence per contact.
--
-- So visitor becomes per-contact, matching the sequence_status checks
-- below it, and the other three keep the company-wide reading 273 gave
-- them.

CREATE OR REPLACE FUNCTION public.cancel_drip_if_prospect_advanced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  company_claimed boolean := false;
  contact_status text;
  contact_seq_status text;
BEGIN
  -- Only the contacted-series drips get the birth guard; stage mails
  -- are enqueued BY promotions and manage their own stop conditions.
  IF NEW.template !~ '^(outreach|prospect|new-professional)-' THEN
    RETURN NEW;
  END IF;

  -- Has anyone at this firm claimed the page, or started to?
  IF NEW.company_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
        FROM public.prospects
       WHERE company_id = NEW.company_id
         AND status::text IN ('verified', 'owned', 'active')
    ) INTO company_claimed;
  END IF;

  IF company_claimed THEN
    NEW.cancelled_at := now();
    NEW.cancelled_reason := 'status_change';
    RETURN NEW;
  END IF;

  -- This row's own recipient, for the per-contact checks. Prefer the
  -- prospect row that also matches the company, since one address can
  -- hold two rows under different sources.
  SELECT status::text, sequence_status::text
    INTO contact_status, contact_seq_status
    FROM public.prospects
   WHERE lower(email) = lower(NEW.email)
   ORDER BY (company_id IS NOT DISTINCT FROM NEW.company_id) DESC,
            created_at DESC
   LIMIT 1;

  IF contact_status = 'visitor' THEN
    NEW.cancelled_at := now();
    NEW.cancelled_reason := 'status_change';
  ELSIF contact_seq_status = 'finished' THEN
    NEW.cancelled_at := now();
    NEW.cancelled_reason := 'manual';
  ELSIF contact_seq_status = 'paused' THEN
    NEW.cancelled_at := now();
    NEW.cancelled_reason := 'paused';
  END IF;

  RETURN NEW;
END;
$function$;

-- Repair the rows the stricter guard killed at birth.
--
-- cancelled_at = created_at is the fingerprint of a birth cancel —
-- migration 234 used the same one for the verified-reminders its guard
-- killed. Narrow deliberately: only rows written since 273 went in,
-- only where no contact at the company got past 'visitor', and only
-- where the send is still in the future, so nothing is resurrected that
-- should have gone out days ago.

UPDATE public.email_drip_queue q
   SET cancelled_at = NULL, cancelled_reason = NULL
 WHERE q.cancelled_at = q.created_at
   AND q.cancelled_reason = 'status_change'
   AND q.sent_at IS NULL
   AND q.created_at >= '2026-10-02 12:00:00+00'
   AND q.send_at > now()
   AND q.company_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.prospects p
      WHERE p.company_id = q.company_id
        AND p.status::text IN ('verified', 'owned', 'active')
   );
