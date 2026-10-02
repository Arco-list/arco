-- One sequence per CONTACT, not one per company.
--
-- Two people at the same firm could not both be enrolled. The queue's
-- unique index was keyed on (company_id, template), so the first
-- contact's rows claimed the slot and the second contact's insert hit
-- 23505 — swallowed as "already enrolled". That contact was left at
-- sequence_status='active' with nothing scheduled and never mailed:
-- nagore@hofmandujardin.nl, started alongside her colleague Bo, has
-- zero queue rows and zero sends.
--
-- Until today the intro escaped the index (it was sent straight through
-- Resend), so the second contact at least received the opening mail and
-- only lost the follow-ups. Now that every step is queued, the index
-- governs the whole sequence — which is what made the gap total, and
-- what makes this the moment to decide. The decision: enrol everyone.
--
-- Three things have to change together, or enrolling a second contact
-- produces rows that are cancelled the instant they are written.
--
-- APPLIED IN TWO PASSES on 2 October 2026. The MCP migration tool
-- refuses DROP statements — the same refusal that left the Xero tables
-- standing earlier the same day — so everything below ran as
-- `sequence_per_contact_without_drop`, and the DROP INDEX on the first
-- line was run by hand afterwards. The file is the whole change and
-- re-runs correctly anywhere else; only the ledger is split.

-- ── 1. The uniqueness key is the person ─────────────────────────────
--
-- Keyed on the ADDRESS rather than (company, email): company_id is
-- irrelevant to "has this person already got one of these pending", and
-- it is NULL for every Apollo contact whose domain never matched a
-- company — so the old index did not dedupe those at all. On lower()
-- because an address differing only in case is the same inbox.
--
-- Verified before applying: 0 pending rows collide under this key, and
-- all 3,435 queue rows already store a lowercased address.

DROP INDEX IF EXISTS public.idx_drip_queue_company_template_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_drip_queue_email_template_unique
  ON public.email_drip_queue (lower(email), template)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;

COMMENT ON INDEX public.idx_drip_queue_email_template_unique IS
  'One pending mail of each template per recipient. Replaces the (company_id, template) key, which allowed only one contact per company to hold a sequence and silently dropped every colleague enrolled after the first.';

-- ── 2. The birth guard has to ask about the right person ────────────
--
-- This BEFORE INSERT trigger cancels a row the moment it is written if
-- the contact has already moved on. It read ONE prospect per company —
-- `ORDER BY created_at DESC LIMIT 1` — which was tolerable while a
-- company could hold only one sequence and is wrong the moment it can
-- hold several:
--
--   * the FUNNEL STATUS is a fact about the firm. If anybody there has
--     visited, verified, claimed or listed, nobody needs "claim your
--     page" any more. But "the newest contact row" is not "anybody":
--     with Bo advanced and Nagore not, it read Nagore and cancelled
--     nothing. Now it asks whether ANY contact has advanced.
--
--   * the SEQUENCE STATUS is a fact about one person. Reading a
--     colleague's paused or finished sequence to kill this contact's
--     fresh rows is simply the wrong row — and it is exactly what would
--     have happened on the first enrolment of a second contact at a
--     company whose first contact was paused. Now it asks about the
--     recipient of this very row.

CREATE OR REPLACE FUNCTION public.cancel_drip_if_prospect_advanced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  company_advanced boolean := false;
  contact_seq_status text;
BEGIN
  -- Only the contacted-series drips get the birth guard; stage mails
  -- are enqueued BY promotions and manage their own stop conditions.
  IF NEW.template !~ '^(outreach|prospect|new-professional)-' THEN
    RETURN NEW;
  END IF;

  -- Has ANYONE at this firm moved past 'contacted'? Company-level, and
  -- only when the row is tied to a company at all.
  IF NEW.company_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
        FROM public.prospects
       WHERE company_id = NEW.company_id
         AND status::text IN ('visitor', 'verified', 'owned', 'active')
    ) INTO company_advanced;
  END IF;

  IF company_advanced THEN
    NEW.cancelled_at := now();
    NEW.cancelled_reason := 'status_change';
    RETURN NEW;
  END IF;

  -- This row's own recipient. Prefer the prospect row that also matches
  -- the company, since one address can hold two rows under different
  -- sources (the constraint on prospects is (email, source)).
  SELECT sequence_status::text
    INTO contact_seq_status
    FROM public.prospects
   WHERE lower(email) = lower(NEW.email)
   ORDER BY (company_id IS NOT DISTINCT FROM NEW.company_id) DESC,
            created_at DESC
   LIMIT 1;

  IF contact_seq_status = 'finished' THEN
    NEW.cancelled_at := now();
    NEW.cancelled_reason := 'manual';
  ELSIF contact_seq_status = 'paused' THEN
    NEW.cancelled_at := now();
    NEW.cancelled_reason := 'paused';
  END IF;

  RETURN NEW;
END;
$function$;

-- ── 3. Release the contacts the old key stranded ────────────────────
--
-- sequence_status='active' with nothing queued and nothing ever sent is
-- not a running sequence, it is the 23505 that was swallowed. Worse, it
-- is self-sealing: every bulk action filters on 'not_started', so these
-- rows could never be started again by hand either.
--
-- Back to not_started so they are eligible once more. Deliberately
-- narrow — any contact with a queue row or a single send is left alone.

UPDATE public.prospects p
   SET sequence_status = 'not_started'
 WHERE p.sequence_status = 'active'
   AND NOT EXISTS (
     SELECT 1 FROM public.email_drip_queue q
      WHERE lower(q.email) = lower(p.email)
        AND q.cancelled_at IS NULL
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.email_events e
      WHERE lower(e.recipient_email) = lower(p.email)
        AND e.event_type = 'sent'
   );
