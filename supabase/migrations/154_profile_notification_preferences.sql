-- profiles.notification_preferences had been read/written by the
-- /homeowner notification settings UI for a while, but the column
-- itself was never added — the writes silently no-op'd, so the
-- in-app toggle never persisted. Add the column with a default
-- that matches the soft opt-in semantic (marketing emails ON for
-- new signups; recipients opt out via the toggle or the
-- List-Unsubscribe link in any marketing email).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb
  NOT NULL DEFAULT '{"marketing": true}'::jsonb;

-- Backfill: anyone who already clicked List-Unsubscribe (we have
-- prospects.unsubscribed_at IS NOT NULL for their email) should
-- have their freshly-defaulted preference flipped to false. Without
-- this, the toggle would render as ON for users who have already
-- unsubscribed via email.
UPDATE public.profiles p
SET notification_preferences = jsonb_set(
  p.notification_preferences,
  '{marketing}',
  'false'::jsonb
)
FROM auth.users u
WHERE p.id = u.id
  AND EXISTS (
    SELECT 1 FROM public.prospects pr
    WHERE LOWER(pr.email) = LOWER(u.email)
      AND pr.unsubscribed_at IS NOT NULL
  );
