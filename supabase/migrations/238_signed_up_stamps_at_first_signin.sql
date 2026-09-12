-- ═══════════════════════════════════════════════════════════════════════
-- 238: "Signed up" stamps at the FIRST VERIFIED SESSION, not at code-send
-- ═══════════════════════════════════════════════════════════════════════
-- signUpWithOtpAction pre-creates the account when the signup code is
-- SENT; matchProspectOnSignup used to stamp prospects.signed_up_at and
-- log 'prospect.signed_up' right there — so abandoned signups (ghosts)
-- counted as real signups in the prospect timeline and metrics.
--
-- Split model:
--   * code-send      → 'prospect.signup_started' (app-side, links user_id
--                      only; drips keep chasing the unverified account)
--   * first session  → this trigger: stamp signed_up_at, retire the
--                      sequence flag, log 'prospect.signed_up'
--   * OAuth callback → matchProspectOnSignup (session exists at creation,
--                      so it stays the verified path; a signed_up_at
--                      guard prevents double-stamping either way)
--
-- Same hook as the homeowner-welcome trigger (migration 233):
-- auth.users.last_sign_in_at flipping NULL → NOT NULL. Known parity gap
-- vs the TS path: no Apollo sequence-stop here — acceptable, the claim
-- flow that follows syncs Apollo, and earlier stage promotions already
-- moved the contact.

CREATE OR REPLACE FUNCTION stamp_prospect_signed_up_on_first_signin()
RETURNS trigger AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    UPDATE public.prospects
    SET signed_up_at = now(), sequence_status = 'finished'
    WHERE user_id = NEW.id AND signed_up_at IS NULL
    RETURNING id, status
  LOOP
    INSERT INTO public.prospect_events (prospect_id, event_type, event_source, old_status, new_status, metadata)
    VALUES (r.id, 'prospect.signed_up', 'db', r.status, r.status,
      jsonb_build_object('via', 'first_signin', 'user_id', NEW.id));
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_prospect_signed_up_on_signin ON auth.users;
CREATE TRIGGER trigger_prospect_signed_up_on_signin
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS NULL AND NEW.last_sign_in_at IS NOT NULL)
  EXECUTE FUNCTION stamp_prospect_signed_up_on_first_signin();
