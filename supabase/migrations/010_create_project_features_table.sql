-- Migration: Create project_features table
-- Description: Adds feature-level metadata to support photo tour grouping.

CREATE TABLE public.project_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id),
  name text NOT NULL,
  tagline text CHECK (char_length(tagline) <= 200),
  description text CHECK (char_length(description) <= 500),
  is_highlighted boolean NOT NULL DEFAULT false,
  is_building_default boolean NOT NULL DEFAULT false,
  cover_photo_id uuid REFERENCES public.project_photos(id),
  order_index integer NOT NULL DEFAULT 0 CHECK (order_index >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT project_features_unique_name_per_project UNIQUE (project_id, name)
);

CREATE INDEX idx_project_features_project_id ON public.project_features(project_id);
CREATE INDEX idx_project_features_category_id ON public.project_features(category_id);

COMMENT ON TABLE public.project_features IS 'Rooms/features used to organise project photos';
COMMENT ON COLUMN public.project_features.is_building_default IS 'True for the default “Building” grouping shown when no feature is assigned';

ALTER TABLE public.project_features ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER handle_project_features_updated_at
  BEFORE UPDATE ON public.project_features
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
