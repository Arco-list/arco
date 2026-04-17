-- ═══════════════════════════════════════════════════════════════════════
-- 138: Widen the client welcome drip cadence (0 / 2 / 5 → 0 / 3 / 10)
-- ═══════════════════════════════════════════════════════════════════════
-- Hiring an architect is a low-frequency, high-consideration decision.
-- Most clients browse over weekends and return the next weekend. The
-- old 0/2/5 cadence fired the second email midweek — often when the
-- recipient hadn't thought about the project since signup. The new
-- 0/3/10 cadence aligns each email with the next weekend after signup:
--
--   Day 0  Welcome           — sent immediately (unchanged)
--   Day 3  Discover Projects — was Day 2; hits the weekend after signup
--   Day 10 Find Professionals — was Day 5; hits the second weekend
--
-- Only the send_at intervals change. Template ids, sequence name,
-- step numbers and variables are identical to migration 118.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION enqueue_homeowner_welcome()
RETURNS trigger AS $$
BEGIN
  IF NEW.user_types @> ARRAY['client']::text[] AND (OLD IS NULL OR NOT (OLD.user_types @> ARRAY['client']::text[])) THEN
    DECLARE
      user_email text;
      user_first_name text;
    BEGIN
      SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;
      user_first_name := COALESCE(NEW.first_name, '');

      IF user_email IS NOT NULL THEN
        INSERT INTO email_drip_queue (user_id, email, template, sequence, step, variables, send_at)
        VALUES (NEW.id, user_email, 'welcome-homeowner', 'homeowner-welcome', 1,
          jsonb_build_object('firstname', user_first_name), now())
        ON CONFLICT (user_id, sequence, step) DO NOTHING;

        INSERT INTO email_drip_queue (user_id, email, template, sequence, step, variables, send_at)
        VALUES (NEW.id, user_email, 'discover-projects', 'homeowner-welcome', 2,
          jsonb_build_object('firstname', user_first_name), now() + interval '3 days')
        ON CONFLICT (user_id, sequence, step) DO NOTHING;

        INSERT INTO email_drip_queue (user_id, email, template, sequence, step, variables, send_at)
        VALUES (NEW.id, user_email, 'find-professionals', 'homeowner-welcome', 3,
          jsonb_build_object('firstname', user_first_name), now() + interval '10 days')
        ON CONFLICT (user_id, sequence, step) DO NOTHING;
      END IF;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-push pending rows for in-flight sequences so existing clients get
-- the new cadence too. Only touches step 2 (Day 3) and step 3 (Day 10);
-- already-sent or cancelled rows are untouched.
--
-- For step 2 (discover-projects): shift the scheduled send by +1 day
-- from today if it hasn't fired yet. Shifting from the original Day 2
-- to Day 3 keeps the felt cadence roughly aligned with when they signed
-- up, without jumping everyone to "three days from right now".
UPDATE email_drip_queue
   SET send_at = send_at + interval '1 day'
 WHERE template = 'discover-projects'
   AND sequence = 'homeowner-welcome'
   AND sent_at IS NULL
   AND cancelled_at IS NULL;

-- For step 3 (find-professionals): original Day 5 → new Day 10, so
-- +5 days from the scheduled send.
UPDATE email_drip_queue
   SET send_at = send_at + interval '5 days'
 WHERE template = 'find-professionals'
   AND sequence = 'homeowner-welcome'
   AND sent_at IS NULL
   AND cancelled_at IS NULL;
