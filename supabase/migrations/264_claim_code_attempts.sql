-- Count the guesses against a claim verification code.
--
-- The code is six digits — 900,000 possibilities — and nothing limited
-- how often one could be tried. checkRateLimit guards the SENDING side
-- (3 per 15 minutes per mailbox) but never the verifying side, and
-- there is no global limiter in middleware either. So the only thing
-- standing between an attacker and a company page was the ten-minute
-- lifetime, quietly doing security work nobody had assigned it.
--
-- That is why the lifetime could not simply be raised to match the
-- auth codes: an hour is six times the window, and six times the
-- guesses, with nothing else in the way. Supabase can afford an hour on
-- its own OTPs because it limits verification attempts internally. We
-- had no equivalent.
--
-- IN THE DATABASE, NOT IN THE RATE LIMITER. checkRateLimit returns
-- success for everything when Upstash is not configured — by design,
-- so a missing integration cannot take the site down. That makes it the
-- wrong place for a control whose absence is invisible: a limiter that
-- silently permits everything reads exactly like a limiter that works.
-- The counter rides on the code row, which already exists, is already
-- one-shot and already expires.

ALTER TABLE public.claim_email_verification_codes
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.claim_email_verification_codes.attempts IS
  'Wrong guesses against this code. The row is deleted once it passes MAX_ATTEMPTS (lib/claim/email-verification.ts), so a burned code cannot be ground down.';
