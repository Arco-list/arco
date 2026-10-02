-- Pull apart the sequence steps that were scheduled on top of each other.
--
-- 386 queued mails sit on the same minute as an earlier step of the same
-- sequence to the same person: a day-3 follow-up and a day-10 final,
-- both at 07:40, both on 2 October. The reader was going to receive
-- "following up on my note" and "this is the last you'll hear from me"
-- in the same second.
--
-- Two causes, both fixed in code alongside this:
--
--   1. claimNextSendSlot claimed nothing. It read the table for the last
--      used slot and returned one after it, writing nothing — so a
--      caller allocating two slots before inserting either read the same
--      state twice and got the same answer twice.
--   2. The send window held 24 slots a day against ~70 mails a working
--      day. Three times oversubscribed, so both steps rolled forward to
--      the same first day with room, where cause 1 then gave them the
--      same minute.
--
-- This repairs the rows those causes already produced. New rows are
-- allocated through claimSequenceSlots and cannot land this way again.
--
-- THE SHIFT IS SEVEN DAYS, which is the gap the outreach sequence was
-- designed around (day 3 to day 10) and also the gap that preserves the
-- weekday: a Friday stays a Friday, so not one of the 386 lands on a
-- weekend and no business-day arithmetic is needed here.
--
-- Only the later step moves. The first step of each collision keeps its
-- slot, so nothing is brought forward and nobody is mailed sooner than
-- they would have been.
--
-- Verified before applying: 0 same-day pairs remain per sequence, 0 per
-- recipient across sequences, and the busiest resulting day holds 51
-- rows against a window that now has 180 slots.

WITH gestapeld AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY email, sequence, send_at::date
           ORDER BY step
         ) AS rang
    FROM public.email_drip_queue
   WHERE sent_at IS NULL
     AND cancelled_at IS NULL
)
UPDATE public.email_drip_queue q
   SET send_at = q.send_at + ((g.rang - 1) * interval '7 days')
  FROM gestapeld g
 WHERE q.id = g.id
   AND g.rang > 1;
