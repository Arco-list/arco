-- Migration 259 imported e-mail clicks as claim-page arrivals. Undo that.
--
-- 'prospect.landing_visited' turns out to mean two different things,
-- written by two different senders:
--
--   event_source 'app'    — the page itself, when somebody arrived
--   event_source 'resend' — the Resend webhook, when somebody CLICKED
--
-- 259 took the event type at face value and copied both. 187 of its 314
-- rows were clicks, so Sales arrivals came out about 60% too high.
--
-- A click is not an arrival, and the difference is the whole reason
-- this project moved to server-side landing stamps: Resend counts a
-- click when corporate mail security opens the link from a datacenter,
-- which is what used to push the invite conversion over 100%. A
-- ledger of who reached the claim page must not be seeded with who
-- was scanned.
--
-- Only rows this backfill created are touched — source_ref is NULL on
-- everything /claim wrote live, and those are left alone.
DELETE FROM public.claim_arrivals ca
USING public.prospect_events ev
WHERE ca.source_ref = 'pe:' || ev.id
  AND ev.event_type = 'prospect.landing_visited'
  AND (
    ev.event_source = 'resend_webhook'
    OR ev.metadata->>'via' LIKE 'email_click%'
  );
