-- ═══════════════════════════════════════════════════════════════════════
-- 236: Professionals don't get the homeowner welcome drip
-- ═══════════════════════════════════════════════════════════════════════
-- A professional who claims their company gets a client account as a
-- side effect, and the first verified session then enqueued the
-- homeowner welcome series (welcome / discover-projects /
-- find-professionals) — homeowner onboarding aimed at someone who just
-- claimed a business page, on top of the owned/listed pro mails, with
-- one unsubscribe killing both funnels.
--
-- The guard lives in the SHARED enqueue function so both triggers
-- (first sign-in on auth.users, client-type-added on profiles) are
-- covered: skip when the user already carries the professional type or
-- owns a company (the claim flow sets ownership before the first
-- sign-in). The drip cron additionally re-checks at send time, so a
-- user who turns professional mid-series stops receiving the rest.

CREATE OR REPLACE FUNCTION enqueue_homeowner_welcome_rows(p_user_id uuid, p_email text, p_first_name text)
RETURNS void AS $$
DECLARE
  v_types text[];
BEGIN
  -- Professionals get the pro onboarding, not the homeowner drip.
  SELECT user_types INTO v_types FROM public.profiles WHERE id = p_user_id;
  IF v_types @> ARRAY['professional']::text[] THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.companies c WHERE c.owner_id = p_user_id) THEN
    RETURN;
  END IF;

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
