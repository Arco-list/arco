-- Per-credit invite dedup.
--
-- The publish-time sweep (dispatchPendingInvitesForProject) used to skip
-- any recipient who had EVER received a new-professional-invite, so a
-- company credited on a second project was never emailed — and it had no
-- way to tell an un-sent credit from one whose email went out. Stamp the
-- credit row when its invite is actually dispatched; the sweep keys on
-- this instead.
ALTER TABLE public.project_professionals
  ADD COLUMN IF NOT EXISTS invite_dispatched_at timestamptz;

COMMENT ON COLUMN public.project_professionals.invite_dispatched_at IS
  'When the invite email for this credit was sent (one-shot or drip intro). NULL = never dispatched.';

-- Backfill from sends already recorded, so credits that were emailed
-- before this column existed are not emailed again on the next publish.
UPDATE public.project_professionals pp
SET invite_dispatched_at = e.first_sent
FROM (
  SELECT lower(recipient_email) AS email, min(occurred_at) AS first_sent
  FROM public.email_events
  WHERE template IN ('new-professional-invite', 'professional-invite')
    AND event_type = 'sent'
  GROUP BY lower(recipient_email)
) e
WHERE pp.is_project_owner = false
  AND pp.invite_dispatched_at IS NULL
  AND pp.invited_email IS NOT NULL
  AND lower(pp.invited_email) = e.email;
