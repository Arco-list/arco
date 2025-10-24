-- Migration: Convert reviews from professional-based to company-based
-- Description: Change reviews.professional_id to company_id and update all related functions/triggers

-- Step 1: Drop the trigger that updates professional_ratings
DROP TRIGGER IF EXISTS update_professional_ratings_on_review ON public.reviews;

-- Step 2: Drop the old indexes
DROP INDEX IF EXISTS idx_reviews_professional_rating;
DROP INDEX IF EXISTS idx_reviews_moderation_status;

-- Step 3: Drop the foreign key constraint
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_professional_id_fkey;

-- Step 4: Drop the no-self-review constraint (will recreate later)
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_no_self_review;

-- Step 4a: Drop RLS policies that depend on professional_id
DROP POLICY IF EXISTS reviews_professional_read_own ON public.reviews;
DROP POLICY IF EXISTS reviews_professional_respond ON public.reviews;

-- Step 5: Add the new company_id column
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS company_id UUID;

-- Step 6: Migrate existing data: Set company_id based on professional_id
-- (Get the company_id from the professionals table for existing reviews)
UPDATE public.reviews r
SET company_id = p.company_id
FROM public.professionals p
WHERE r.professional_id = p.id
  AND r.company_id IS NULL;

-- Step 7: Make company_id NOT NULL and add foreign key
ALTER TABLE public.reviews ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- Step 8: Drop the old professional_id column
ALTER TABLE public.reviews DROP COLUMN IF EXISTS professional_id;

-- Step 9: No-self-review constraint is now handled by RLS policies
-- (CHECK constraints cannot use subqueries in PostgreSQL)

-- Step 10: Rename professional_ratings table to company_ratings
ALTER TABLE IF EXISTS public.professional_ratings RENAME TO company_ratings;

-- Step 11: Rename the primary key column in company_ratings
ALTER TABLE public.company_ratings RENAME COLUMN professional_id TO company_id;

-- Step 11a: Delete orphaned rating records for non-existent companies
DELETE FROM public.company_ratings cr
WHERE NOT EXISTS (
  SELECT 1 FROM public.companies c WHERE c.id = cr.company_id
);

-- Step 12: Drop and recreate the foreign key on company_ratings
ALTER TABLE public.company_ratings DROP CONSTRAINT IF EXISTS professional_ratings_professional_id_fkey;
ALTER TABLE public.company_ratings
  ADD CONSTRAINT company_ratings_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- Step 13: Recreate indexes with new column names
CREATE INDEX idx_reviews_company_rating
  ON public.reviews(company_id, overall_rating DESC, created_at DESC);

CREATE INDEX idx_reviews_moderation_status
  ON public.reviews(moderation_status, created_at DESC)
  WHERE is_published = FALSE;

-- Step 14: Update the trigger function to use company_id
CREATE OR REPLACE FUNCTION public.update_company_ratings()
RETURNS TRIGGER AS $$
DECLARE
  comp_id UUID;
  avg_overall DECIMAL(3,2);
  avg_quality DECIMAL(3,2);
  avg_reliability DECIMAL(3,2);
  avg_communication DECIMAL(3,2);
  review_count INTEGER;
  last_review TIMESTAMPTZ;
BEGIN
  -- Get the company_id from either NEW or OLD record
  comp_id := COALESCE(NEW.company_id, OLD.company_id);

  -- Calculate new averages and count
  SELECT
    ROUND(AVG(overall_rating), 2),
    ROUND(AVG(quality_rating), 2),
    ROUND(AVG(reliability_rating), 2),
    ROUND(AVG(communication_rating), 2),
    COUNT(*),
    MAX(created_at)
  INTO avg_overall, avg_quality, avg_reliability, avg_communication, review_count, last_review
  FROM public.reviews
  WHERE company_id = comp_id AND is_published = TRUE;

  -- Update the company_ratings table
  INSERT INTO public.company_ratings (
    company_id, overall_rating, quality_rating, reliability_rating,
    communication_rating, total_reviews, last_review_at, updated_at
  )
  VALUES (
    comp_id, COALESCE(avg_overall, 0), COALESCE(avg_quality, 0),
    COALESCE(avg_reliability, 0), COALESCE(avg_communication, 0),
    COALESCE(review_count, 0), last_review, NOW()
  )
  ON CONFLICT (company_id) DO UPDATE SET
    overall_rating = EXCLUDED.overall_rating,
    quality_rating = EXCLUDED.quality_rating,
    reliability_rating = EXCLUDED.reliability_rating,
    communication_rating = EXCLUDED.communication_rating,
    total_reviews = EXCLUDED.total_reviews,
    last_review_at = EXCLUDED.last_review_at,
    updated_at = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 15: Create new trigger for company ratings updates
CREATE TRIGGER update_company_ratings_on_review
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_company_ratings();

-- Step 16: Update handle_new_professional function to use company_ratings
CREATE OR REPLACE FUNCTION public.handle_new_professional()
RETURNS TRIGGER AS $$
BEGIN
  -- Create company_ratings entry if it doesn't exist
  INSERT INTO public.company_ratings (company_id)
  VALUES (NEW.company_id)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 17: Update table comments
COMMENT ON TABLE public.company_ratings IS 'Aggregated rating data for companies';
COMMENT ON COLUMN public.reviews.company_id IS 'The company being reviewed (not individual professional)';

-- Step 18: Recalculate all company ratings from existing reviews
-- Only include companies that actually exist in the companies table
INSERT INTO public.company_ratings (company_id, overall_rating, quality_rating, reliability_rating, communication_rating, total_reviews, last_review_at)
SELECT
  r.company_id,
  ROUND(AVG(r.overall_rating), 2) as overall_rating,
  ROUND(AVG(r.quality_rating), 2) as quality_rating,
  ROUND(AVG(r.reliability_rating), 2) as reliability_rating,
  ROUND(AVG(r.communication_rating), 2) as communication_rating,
  COUNT(*)::INTEGER as total_reviews,
  MAX(r.created_at) as last_review_at
FROM public.reviews r
INNER JOIN public.companies c ON r.company_id = c.id
WHERE r.is_published = TRUE
GROUP BY r.company_id
ON CONFLICT (company_id) DO UPDATE SET
  overall_rating = EXCLUDED.overall_rating,
  quality_rating = EXCLUDED.quality_rating,
  reliability_rating = EXCLUDED.reliability_rating,
  communication_rating = EXCLUDED.communication_rating,
  total_reviews = EXCLUDED.total_reviews,
  last_review_at = EXCLUDED.last_review_at,
  updated_at = NOW();

-- Step 19: Recreate RLS policies with company_id
CREATE POLICY "reviews_company_read_own" ON public.reviews
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.professionals WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "reviews_company_respond" ON public.reviews
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.professionals WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.professionals WHERE user_id = auth.uid()
    )
    AND response_text IS NOT NULL
  );
