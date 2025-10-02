-- Migration: Create project_taxonomy_options table
-- Description: Defines taxonomy enum and options used for project filters.

-- Ensure enum exists for taxonomy types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'project_taxonomy_type'
  ) THEN
    CREATE TYPE public.project_taxonomy_type AS ENUM (
      'project_style',
      'building_type',
      'location_feature',
      'material_feature',
      'size_range',
      'budget_tier'
    );
  END IF;
END$$;

-- Create table for project taxonomy options
CREATE TABLE IF NOT EXISTS public.project_taxonomy_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  taxonomy_type public.project_taxonomy_type NOT NULL,
  description text,
  icon text,
  metadata jsonb,
  sort_order integer,
  is_active boolean NOT NULL DEFAULT true,
  budget_level public.project_budget_level,
  size_min_sqm numeric,
  size_max_sqm numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT project_taxonomy_options_name_check CHECK (char_length(name) >= 2),
  CONSTRAINT project_taxonomy_options_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT project_taxonomy_options_sort_order_check CHECK (sort_order IS NULL OR sort_order >= 0),
  CONSTRAINT project_taxonomy_options_size_range_check CHECK (
    size_min_sqm IS NULL OR size_max_sqm IS NULL OR size_min_sqm <= size_max_sqm
  ),
  CONSTRAINT project_taxonomy_options_budget_level_check CHECK (
    taxonomy_type <> 'budget_tier' OR budget_level IS NOT NULL
  ),
  CONSTRAINT project_taxonomy_options_unique_slug UNIQUE (slug)
);

-- Indexes to speed up lookups
CREATE INDEX IF NOT EXISTS idx_project_taxonomy_options_type
  ON public.project_taxonomy_options(taxonomy_type);

CREATE INDEX IF NOT EXISTS idx_project_taxonomy_options_sort
  ON public.project_taxonomy_options(taxonomy_type, sort_order NULLS LAST, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_taxonomy_options_unique_name_per_type
  ON public.project_taxonomy_options (taxonomy_type, lower(name));

-- Enable row level security and grant read access
ALTER TABLE public.project_taxonomy_options ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_taxonomy_options'
      AND policyname = 'project_taxonomy_options_public_read'
  ) THEN
    CREATE POLICY project_taxonomy_options_public_read
      ON public.project_taxonomy_options
      FOR SELECT
      USING (is_active = TRUE);
  END IF;
END$$;

-- Maintain updated_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'handle_project_taxonomy_options_updated_at'
  ) THEN
    CREATE TRIGGER handle_project_taxonomy_options_updated_at
      BEFORE UPDATE ON public.project_taxonomy_options
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END$$;

COMMENT ON TABLE public.project_taxonomy_options IS 'Normalized taxonomy options powering project filters (styles, features, sizes, budgets).';
COMMENT ON COLUMN public.project_taxonomy_options.taxonomy_type IS 'Type of taxonomy option (style, building type, location feature, etc.)';
COMMENT ON COLUMN public.project_taxonomy_options.metadata IS 'Optional JSON metadata for UI display or integrations.';
