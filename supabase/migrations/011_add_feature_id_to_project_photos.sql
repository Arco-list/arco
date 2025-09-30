-- Migration: Link project_photos to project_features
-- Description: Adds feature_id column so photos can be grouped per feature.

ALTER TABLE public.project_photos
  ADD COLUMN feature_id uuid REFERENCES public.project_features(id) ON DELETE SET NULL;

CREATE INDEX idx_project_photos_feature_id ON public.project_photos(feature_id);

COMMENT ON COLUMN public.project_photos.feature_id IS 'Feature/room this photo belongs to (null defaults to Building feature)';
