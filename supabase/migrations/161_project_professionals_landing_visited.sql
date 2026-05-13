-- 161_project_professionals_landing_visited.sql
--
-- Adds invite-side click tracking to mirror the Sales side. When a
-- pro hits the /businesses/professionals?inviteEmail=… landing page,
-- the page-loader updates landing_visited_at on every matching
-- project_professionals row (one pro can be invited to multiple
-- projects; we record the first visit timestamp per row so each
-- specific invite tracks its own engagement).
--
-- Motivation: the Growth Model's "Pro visitors from Invites" sub
-- previously sourced from PostHog $pageview counts. Link scanners
-- (Outlook Safe Links, Gmail proxies) inflated that count above the
-- contacted denominator, producing >100% conversion ratios. Mirroring
-- the prospect_events.landing_visited pattern gives a server-side,
-- email-keyed source of truth so the ratio reconciles with the
-- actual outreach funnel.

ALTER TABLE public.project_professionals
  ADD COLUMN IF NOT EXISTS landing_visited_at TIMESTAMPTZ;

-- Per-period bucket queries scan by landing_visited_at, often
-- restricted to a 12-month window. Most rows will be NULL (no visit
-- yet), so the partial index keeps it small.
CREATE INDEX IF NOT EXISTS idx_project_professionals_landing_visited_at
  ON public.project_professionals (landing_visited_at)
  WHERE landing_visited_at IS NOT NULL;
