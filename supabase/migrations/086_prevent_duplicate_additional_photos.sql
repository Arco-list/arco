-- Migration: Prevent duplicate "Additional photos" features
-- Description: Add unique constraint and clean up existing duplicates

-- First, identify and delete duplicate "Additional photos" features
-- Keep the oldest one for each project
DO $$
DECLARE
  duplicate_record RECORD;
BEGIN
  FOR duplicate_record IN
    SELECT project_id, MIN(created_at) as keep_created_at
    FROM public.project_features
    WHERE name = 'Additional photos'
      AND is_building_default = false
    GROUP BY project_id
    HAVING COUNT(*) > 1
  LOOP
    -- Delete all "Additional photos" for this project except the oldest
    DELETE FROM public.project_features
    WHERE project_id = duplicate_record.project_id
      AND name = 'Additional photos'
      AND is_building_default = false
      AND created_at > duplicate_record.keep_created_at;
  END LOOP;
END $$;

-- Add a unique partial index to prevent duplicate "Additional photos" per project
-- This allows only ONE "Additional photos" feature per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_additional_photos_per_project
  ON public.project_features (project_id)
  WHERE name = 'Additional photos' AND is_building_default = false;

-- Add a comment explaining this constraint
COMMENT ON INDEX idx_unique_additional_photos_per_project IS
  'Ensures only one "Additional photos" feature exists per project. This is a system-generated catch-all category.';
