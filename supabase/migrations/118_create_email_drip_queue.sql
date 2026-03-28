-- Email drip queue for scheduled email sequences
CREATE TABLE IF NOT EXISTS email_drip_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  template text NOT NULL,
  sequence text NOT NULL,
  step int NOT NULL DEFAULT 1,
  variables jsonb DEFAULT '{}',
  send_at timestamptz NOT NULL,
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, sequence, step)
);

CREATE INDEX idx_drip_queue_pending ON email_drip_queue (send_at) WHERE sent_at IS NULL AND cancelled_at IS NULL;

ALTER TABLE email_drip_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drip_queue_service_only" ON email_drip_queue FOR ALL USING (false);

-- Function to enqueue homeowner welcome series
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
          jsonb_build_object('firstname', user_first_name), now() + interval '2 days')
        ON CONFLICT (user_id, sequence, step) DO NOTHING;

        INSERT INTO email_drip_queue (user_id, email, template, sequence, step, variables, send_at)
        VALUES (NEW.id, user_email, 'find-professionals', 'homeowner-welcome', 3,
          jsonb_build_object('firstname', user_first_name), now() + interval '5 days')
        ON CONFLICT (user_id, sequence, step) DO NOTHING;
      END IF;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_homeowner_welcome ON profiles;
CREATE TRIGGER trigger_homeowner_welcome
  AFTER INSERT OR UPDATE OF user_types ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_homeowner_welcome();
