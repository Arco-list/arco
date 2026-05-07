-- Track deliverability suppressions on prospects, distinct from
-- recipient-initiated unsubscribes. Once an address bounces or
-- complains, EVERY future email to it (Showcase / Invite / Outreach /
-- transactional) will also fail or hurt sender reputation, so the
-- opt-out gate at send time honours these the same way it honours
-- unsubscribed_at.
--
-- Two separate columns instead of one suppressed_at + reason field
-- so per-status analytics (bounce rate vs complaint rate) work
-- naturally — they're categorically different signals (delivery
-- failure vs spam complaint) even if the operational effect is
-- identical.
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS complained_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_prospects_bounced_at
  ON public.prospects(bounced_at)
  WHERE bounced_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prospects_complained_at
  ON public.prospects(complained_at)
  WHERE complained_at IS NOT NULL;
