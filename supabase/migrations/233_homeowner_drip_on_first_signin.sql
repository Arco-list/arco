-- ═══════════════════════════════════════════════════════════════════════
-- 233: Homeowner welcome drip fires at Signup, not Signup Started
-- ═══════════════════════════════════════════════════════════════════════
-- signUpWithOtpAction pre-creates the auth user (email_confirm: true)
-- the moment the signup CODE is sent — before anyone proves the
-- mailbox. The old profiles trigger enqueued the welcome series right
-- there, so abandoned signups ("Signup Started" on /admin/users)
-- received the full homeowner onboarding without ever verifying
-- (Studio TMOJ / MR Architectuur, Sep 2026).
--
-- New model: the series enqueues at the FIRST VERIFIED SESSION —
-- auth.users.last_sign_in_at flipping NULL → NOT NULL — which is the
-- "Signup" step of the client funnel. OAuth signups (Google) create a
-- session at creation, so their timing is unchanged. Accounts that
-- already signed in before this migration never flip again, and their
-- historical rows make the (user_id, sequence, step) conflict a no-op
-- anyway — no backfill, no double sends, ghosts included.

-- Shared enqueue; idempotent via the (user_id, sequence, step) unique
-- constraint from migration 118. Cadence 0/3/10 per migration 138.
CREATE OR REPLACE FUNCTION enqueue_homeowner_welcome_rows(p_user_id uuid, p_email text, p_first_name text)
RETURNS void AS $$
BEGIN
  INSERT INTO email_drip_queue (user_id, email, template, sequence, step, variables, send_at)
  VALUES (p_user_id, p_email, 'welcome-homeowner', 'homeowner-welcome', 1,
    jsonb_build_object('firstname', COALESCE(p_first_name, '')), now())
  ON CONFLICT (user_id, sequence, step) DO NOTHING;

  INSERT INTO email_drip_queue (user_id, email, template, sequence, step, variables, send_at)
  VALUES (p_user_id, p_email, 'discover-projects', 'homeowner-welcome', 2,
    jsonb_build_object('firstname', COALESCE(p_first_name, '')), now() + interval '3 days')
  ON CONFLICT (user_id, sequence, step) DO NOTHING;

  INSERT INTO email_drip_queue (user_id, email, template, sequence, step, variables, send_at)
  VALUES (p_user_id, p_email, 'find-professionals', 'homeowner-welcome', 3,
    jsonb_build_object('firstname', COALESCE(p_first_name, '')), now() + interval '10 days')
  ON CONFLICT (user_id, sequence, step) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 1) The Signup moment: first verified session. Admins sit outside the
--    client funnel; a missing or non-client profile enqueues nothing.
CREATE OR REPLACE FUNCTION enqueue_homeowner_welcome_on_signup()
RETURNS trigger AS $$
DECLARE
  v_types text[];
  v_first_name text;
BEGIN
  SELECT user_types, first_name INTO v_types, v_first_name
    FROM public.profiles WHERE id = NEW.id;
  IF v_types IS NOT NULL
     AND v_types @> ARRAY['client']::text[]
     AND NOT (v_types @> ARRAY['admin']::text[])
     AND NEW.email IS NOT NULL THEN
    PERFORM public.enqueue_homeowner_welcome_rows(NEW.id, NEW.email, v_first_name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_homeowner_welcome_on_signup ON auth.users;
CREATE TRIGGER trigger_homeowner_welcome_on_signup
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS NULL AND NEW.last_sign_in_at IS NOT NULL)
  EXECUTE FUNCTION enqueue_homeowner_welcome_on_signup();

-- 2) Type-added-later: a profile gaining 'client' AFTER the account
--    already has a session (the auth trigger's flip is behind it).
--    Fresh pre-created accounts without a session are left to the auth
--    trigger — this replaces the old INSERT-time enqueue that mailed
--    ghosts.
CREATE OR REPLACE FUNCTION enqueue_homeowner_welcome()
RETURNS trigger AS $$
DECLARE
  v_email text;
  v_signed_in timestamptz;
BEGIN
  IF NEW.user_types @> ARRAY['client']::text[]
     AND NOT (NEW.user_types @> ARRAY['admin']::text[])
     AND NOT (OLD.user_types @> ARRAY['client']::text[]) THEN
    SELECT email, last_sign_in_at INTO v_email, v_signed_in
      FROM auth.users WHERE id = NEW.id;
    IF v_email IS NOT NULL AND v_signed_in IS NOT NULL THEN
      PERFORM public.enqueue_homeowner_welcome_rows(NEW.id, v_email, NEW.first_name);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_homeowner_welcome ON profiles;
CREATE TRIGGER trigger_homeowner_welcome
  AFTER UPDATE OF user_types ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_homeowner_welcome();
