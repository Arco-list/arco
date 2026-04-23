-- ═══════════════════════════════════════════════════════════════════════
-- 144: Per-email engagement tracking on email_drip_queue
-- ═══════════════════════════════════════════════════════════════════════
-- The Resend webhook already stamps opened_at / clicked_at /
-- last_event_cached on company_outreach (the intro row), but the drip
-- queue rows (followup, final) had no per-message tracking — only the
-- aggregate counters on prospects.emails_opened/_clicked.
--
-- The /admin/sales detail popup wants to render an engagement pill per
-- step (sent → delivered → opened → clicked), so the followup and final
-- need the same per-row state. This migration adds the columns; the
-- cron writes resend_message_id on send and the Resend webhook fans
-- updates out to email_drip_queue alongside company_outreach.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.email_drip_queue
  ADD COLUMN IF NOT EXISTS resend_message_id TEXT,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_event_cached TEXT,
  ADD COLUMN IF NOT EXISTS last_event_cached_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_email_drip_queue_resend_message_id
  ON public.email_drip_queue(resend_message_id)
  WHERE resend_message_id IS NOT NULL;
