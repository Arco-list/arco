-- Track recipient-initiated unsubscribes for prospect outreach (Showcase /
-- Invite / Outreach drips).
--
-- One unsubscribe applies to every prospect row sharing that email — if a
-- recipient is on both an Outreach and an Invite for the same company,
-- clicking unsubscribe in either email kills both. Endpoint
-- (/api/unsubscribe) sets this column for *all* matching prospects, then
-- cancels their pending email_drip_queue rows with reason 'unsubscribed'.
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_prospects_unsubscribed_at
  ON public.prospects(unsubscribed_at)
  WHERE unsubscribed_at IS NOT NULL;
