-- Who each mail went to, and when we last reached them.
--
-- Two repairs with one cause: the send path in email-service.ts wrote
-- an email_events row and nothing else. It never resolved the prospect
-- behind the address, and it never touched the prospect's own "last
-- contacted" cache.
--
-- 1. email_events.prospect_id was filled on 91 of 3,810 sends (2%) —
--    even the cold outreach ones, whose entire purpose is a prospect.
--    Every surface wanting "this contact's mail" had to join on the
--    address instead, and the column sat there looking authoritative.
--
-- 2. prospects.last_email_sent_at was only ever written by the drip
--    queue, so mail sent outside it left no trace: 136 contacts showed
--    a Last contact date older than their actual inbox, 132 of them by
--    more than a day. 106 of the 136 were a single template
--    (visitor-nudge-platform); the one that started this was a
--    founding-active mail on 1 October against a column reading 18
--    September.
--
-- Both are now written at send time, at the one point all mail passes
-- through. This repairs the history those two gaps already produced.
--
-- MATCHING ON THE ADDRESS. prospects is unique on (email, source), NOT
-- on email, so one address may hold two rows — an Apollo contact and
-- an invite, say. Today none does (0 of 3,574), but the backfill below
-- is written for the constraint rather than for today's data:
--   * prospect_id prefers the row whose company matches the send's
--     recipient_company_id, then the most recently contacted, and is
--     deterministic either way (ORDER BY ... , id).
--   * last_email_sent_at gives both rows the same answer, which is
--     correct — the mail reached that person whichever row you read.

-- ── 1. prospect_id on historical sends ────────────────────────────────
--
-- Sends only. Engagement rows (delivered/opened/clicked) come from the
-- Resend webhook keyed on the message id and are a separate backfill;
-- this column answers "who was mailed", and a send is where that is
-- decided.

WITH gekozen AS (
  SELECT DISTINCT ON (e.id)
         e.id AS event_id,
         p.id AS prospect_id
    FROM public.email_events e
    JOIN public.prospects p
      ON lower(p.email) = lower(e.recipient_email)
   WHERE e.event_type = 'sent'
     AND e.prospect_id IS NULL
     AND e.recipient_email IS NOT NULL
     AND e.recipient_email <> ''
   ORDER BY e.id,
            -- The company the mail was about wins when we know it.
            (p.company_id IS NOT NULL
             AND p.company_id = e.recipient_company_id) DESC,
            p.last_email_sent_at DESC NULLS LAST,
            p.id
)
UPDATE public.email_events e
   SET prospect_id = g.prospect_id
  FROM gekozen g
 WHERE e.id = g.event_id;

-- ── 2. last_email_sent_at from every send that counts ─────────────────
--
-- WHAT COUNTS IS MAIL WE SENT THEM, not mail they asked for. A sign-in
-- code someone requested themselves is not a sales touch: counting it
-- would float a row to the top of a recency sort because the owner
-- logged in, which tells a rep nothing about whether to call. The same
-- list lives in countsAsContact() in lib/email-channels.ts — this is
-- its SQL twin, and the two must be changed together.
--
-- Templates excluded here and there: the five auth-* mails and
-- domain-verification. Everything else counts, lifecycle included.
--
-- FORWARD ONLY. The send path now stamps this column directly, so the
-- stored value can legitimately be newer than anything a historical
-- event row knows about, and a repair that moves a date backwards is
-- not a repair.

WITH laatste AS (
  SELECT lower(recipient_email) AS email,
         max(occurred_at)       AS verstuurd
    FROM public.email_events
   WHERE event_type = 'sent'
     AND recipient_email IS NOT NULL
     AND recipient_email <> ''
     AND (template IS NULL OR template NOT IN (
           'auth-confirm-signup',
           'auth-magic-link',
           'auth-recovery',
           'auth-email-change',
           'auth-invite',
           'domain-verification'
         ))
   GROUP BY 1
)
UPDATE public.prospects p
   SET last_email_sent_at = l.verstuurd
  FROM laatste l
 WHERE lower(p.email) = l.email
   AND (p.last_email_sent_at IS NULL OR l.verstuurd > p.last_email_sent_at);

COMMENT ON COLUMN public.prospects.last_email_sent_at IS
  'The last time we mailed this contact, through any path. Stamped by sendTransactionalEmail for every send that countsAsContact() admits — mail the recipient triggered themselves (auth codes, domain verification) deliberately does not move it. Was written only by the drip queue until migration 272, which is why lifecycle and nudge mail left it stale.';
