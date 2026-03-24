-- Migration: Add notification_preferences JSONB column to profiles
-- Stores user email notification preferences as a JSON object.

ALTER TABLE public.profiles
  ADD COLUMN notification_preferences JSONB NOT NULL DEFAULT '{"project_updates": true, "marketing": false}'::jsonb;

COMMENT ON COLUMN public.profiles.notification_preferences IS 'User email notification preferences (JSONB). Keys: project_updates, marketing.';

NOTIFY pgrst, 'reload schema';
