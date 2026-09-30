-- Count the guesses against the signed-in domain verification code too.
--
-- The sibling of migration 264. That one covered the claim funnel's
-- code (lib/claim/email-verification.ts); this covers the one
-- create-company uses (lib/verification.ts), which had the same hole.
--
-- THE ATTACK IS THE SAME SHAPE, and the key makes it plain: the row is
-- (user_id, domain). Somebody with an account asks for a code on a
-- domain they do not own, the code is mailed to a mailbox they cannot
-- read — and the row waits on THEIR user id, where they may guess at it
-- as often as they like. Six digits, unlimited tries. The 3-per-15-
-- minutes limit sits on sending, never on guessing.
--
-- WITH A COUNTER, THE CLOCK STOPS BEING A SECURITY CONTROL. Five
-- guesses out of 900,000 is negligible whether the code lives ten
-- minutes or an hour, so the lifetime can be chosen for the reader
-- instead of against the attacker — and set to the same hour every
-- other code on the platform now gets. One number, one sentence in the
-- mail, nothing to keep in step.

ALTER TABLE public.domain_verification_codes
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.domain_verification_codes.attempts IS
  'Wrong guesses against this code. The row is deleted once it passes MAX_ATTEMPTS (lib/verification.ts), so a burned code cannot be ground down.';
