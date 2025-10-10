-- Migration: Introduce review moderation workflow
-- Description: Adds moderation metadata to reviews and grants admins moderation access

BEGIN;

-- Create enum for review moderation status if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'review_moderation_status'
  ) THEN
    CREATE TYPE public.review_moderation_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END$$;

-- Add moderation columns to reviews table
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS moderation_status public.review_moderation_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderation_notes TEXT;

-- Constrain moderation notes length
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reviews_moderation_notes_length'
      AND conrelid = 'public.reviews'::regclass
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_moderation_notes_length CHECK (moderation_notes IS NULL OR length(moderation_notes) <= 1000);
  END IF;
END$$;

-- Backfill moderation status for existing records
UPDATE public.reviews
SET
  moderation_status = CASE
    WHEN is_published = TRUE THEN 'approved'
    ELSE moderation_status
  END,
  moderated_at = CASE
    WHEN is_published = TRUE THEN COALESCE(moderated_at, updated_at, created_at)
    ELSE moderated_at
  END
WHERE moderation_status = 'pending';

-- Ensure future inserts default to pending + unpublished
ALTER TABLE public.reviews
  ALTER COLUMN is_published SET DEFAULT FALSE;

-- Create index to support moderation queue ordering
CREATE INDEX IF NOT EXISTS idx_reviews_moderation_queue ON public.reviews (moderation_status, created_at DESC);

-- Admins can read all reviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reviews'
      AND policyname = 'reviews_admin_read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY reviews_admin_read ON public.reviews
        FOR SELECT
        USING (public.is_admin());
    $policy$;
  END IF;
END$$;

-- Admins can moderate reviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reviews'
      AND policyname = 'reviews_admin_moderate'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY reviews_admin_moderate ON public.reviews
        FOR UPDATE
        USING (public.is_admin())
        WITH CHECK (public.is_admin());
    $policy$;
  END IF;
END$$;

COMMIT;
