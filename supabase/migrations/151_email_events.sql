-- Unified email events table — single source of truth for every email sent
-- and every engagement event (delivered/opened/clicked/bounced) across all
-- providers (Resend today, Apollo soon, future).
--
-- One row per provider-emitted event. A single Resend message produces
-- multiple rows: one 'sent' (inserted by sendTransactionalEmail), then a
-- 'delivered' / 'opened' / 'clicked' / 'bounced' as Resend's webhook fires.
-- Apollo per-message events are upserted by the sync cron.
--
-- Idempotency: UNIQUE(provider, provider_event_id). Caller chooses the id
-- so it's stable across retries — for Resend sends use the message id, for
-- Resend webhooks use the webhook event id, for Apollo use the message id.

CREATE TABLE IF NOT EXISTS email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  recipient_email text NOT NULL,
  recipient_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL,
  campaign_kind text,
  campaign_id text,
  campaign_position int,
  template text,
  subject text,
  locale text,
  occurred_at timestamptz NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_events_event_type_check CHECK (
    event_type IN (
      'sent','delivered','opened','clicked','bounced','complained','unsubscribed','failed'
    )
  ),
  CONSTRAINT email_events_provider_event_id_unique UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS email_events_recipient_email_idx
  ON email_events (recipient_email, occurred_at DESC);
CREATE INDEX IF NOT EXISTS email_events_campaign_kind_idx
  ON email_events (campaign_kind, occurred_at DESC);
CREATE INDEX IF NOT EXISTS email_events_user_idx
  ON email_events (recipient_user_id, occurred_at DESC) WHERE recipient_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_events_prospect_idx
  ON email_events (prospect_id, occurred_at DESC) WHERE prospect_id IS NOT NULL;

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

-- Admin-only read; service role writes from server-side code.
CREATE POLICY email_events_admin_read ON email_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND ('admin' = ANY(profiles.user_types) OR profiles.admin_role IS NOT NULL)
    )
  );

COMMENT ON TABLE email_events IS
  'Unified per-event record of every email sent and tracked across providers (Resend, Apollo). One row per event_type per message. Idempotent on (provider, provider_event_id). Used by /admin/emails, /admin/sales, and growth-table metrics.';
