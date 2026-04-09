-- Cache the latest Resend `last_event` per outreach row so the admin emails
-- dashboard doesn't have to re-fetch every prospect-intro from Resend on
-- every page load. The fetch path was hitting Resend's per-message endpoint
-- once per outreach row sequentially, which is slow and rate-limited.
--
-- Strategy: webhooks update this column live as events come in
-- (delivered/opened/clicked/bounced/complained), and the dashboard only
-- falls back to `resend.emails.get()` for rows that haven't reached a
-- terminal state yet.

alter table public.company_outreach
  add column if not exists last_event_cached text;

alter table public.company_outreach
  add column if not exists last_event_cached_at timestamp with time zone;

comment on column public.company_outreach.last_event_cached is
  'Most recent Resend last_event for this email. Updated by the Resend webhook. Terminal states (delivered, opened, clicked, bounced, complained) make the row safe to skip on subsequent dashboard loads.';

-- Backfill terminal states from existing webhook-derived columns:
-- if we already saw a click, we know the message was clicked.
update public.company_outreach
  set last_event_cached = 'clicked',
      last_event_cached_at = clicked_at
  where clicked_at is not null and last_event_cached is null;

update public.company_outreach
  set last_event_cached = 'opened',
      last_event_cached_at = opened_at
  where opened_at is not null and last_event_cached is null;
