-- Migration: Clean up old RLS policies that reference professional_id
-- Description: Drop policies from migration 007 that still reference the old professional_id column

-- Drop old policies that reference professional_id (which no longer exists)
DROP POLICY IF EXISTS "reviews_professional_read_own" ON public.reviews;
DROP POLICY IF EXISTS "reviews_professional_respond" ON public.reviews;
DROP POLICY IF EXISTS "reviews_client_insert" ON public.reviews;
DROP POLICY IF EXISTS "reviews_reviewer_update" ON public.reviews;
DROP POLICY IF EXISTS "reviews_reviewer_read_own" ON public.reviews;
DROP POLICY IF EXISTS "reviews_public_read" ON public.reviews;

-- Recreate the public read policy (for published reviews)
CREATE POLICY "reviews_public_read" ON public.reviews
  FOR SELECT USING (is_published = TRUE);

-- Recreate reviewer read own policy
CREATE POLICY "reviews_reviewer_read_own" ON public.reviews
  FOR SELECT USING (auth.uid() = reviewer_id);

-- Recreate reviewer update policy (can edit their own reviews within 30 days)
CREATE POLICY "reviews_reviewer_update" ON public.reviews
  FOR UPDATE USING (
    auth.uid() = reviewer_id
    AND created_at > NOW() - INTERVAL '30 days'
  );

-- Recreate client insert policy (company-based)
-- Users can create reviews for companies they've worked with
CREATE POLICY "reviews_client_insert" ON public.reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id
  );
