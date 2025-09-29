-- Migration: Create projects and project_photos tables
-- Description: Project listings with associated photos and metadata

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status project_status DEFAULT 'draft',
  budget_level project_budget_level,
  budget_min DECIMAL(12,2),
  budget_max DECIMAL(12,2),
  location TEXT,
  project_type TEXT, -- e.g., 'Villa', 'House', 'Apartment'
  building_type TEXT, -- e.g., 'New Construction', 'Renovation'
  project_size TEXT, -- e.g., 'Small', 'Medium', 'Large'
  style_preferences TEXT[], -- e.g., ['Contemporary', 'Modern']
  features TEXT[], -- e.g., ['Swimming Pool', 'Garden', 'Garage']
  start_date DATE,
  completion_date DATE,
  project_year INTEGER,
  building_year INTEGER,
  slug TEXT UNIQUE,
  seo_title TEXT,
  seo_description TEXT,
  is_featured BOOLEAN DEFAULT FALSE,
  likes_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT projects_title_length CHECK (length(title) >= 3),
  CONSTRAINT projects_description_length CHECK (description IS NULL OR length(description) <= 5000),
  CONSTRAINT projects_budget_valid CHECK (
    (budget_min IS NULL AND budget_max IS NULL) OR
    (budget_min IS NOT NULL AND budget_max IS NOT NULL AND budget_min <= budget_max AND budget_min >= 0)
  ),
  CONSTRAINT projects_dates_valid CHECK (
    (start_date IS NULL OR completion_date IS NULL) OR
    (start_date <= completion_date)
  ),
  CONSTRAINT projects_years_valid CHECK (
    (project_year IS NULL OR (project_year >= 1800 AND project_year <= EXTRACT(YEAR FROM NOW()) + 10)) AND
    (building_year IS NULL OR (building_year >= 1800 AND building_year <= EXTRACT(YEAR FROM NOW()) + 10))
  ),
  CONSTRAINT projects_slug_format CHECK (slug IS NULL OR slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT projects_counts_positive CHECK (likes_count >= 0 AND views_count >= 0)
);

-- Create project_photos table
CREATE TABLE public.project_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  caption TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  storage_path TEXT, -- Supabase Storage path
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT project_photos_url_not_empty CHECK (length(url) > 0),
  CONSTRAINT project_photos_caption_length CHECK (caption IS NULL OR length(caption) <= 500),
  CONSTRAINT project_photos_order_positive CHECK (order_index >= 0),
  CONSTRAINT project_photos_dimensions_positive CHECK (
    (width IS NULL AND height IS NULL) OR
    (width > 0 AND height > 0)
  ),
  CONSTRAINT project_photos_file_size_positive CHECK (file_size IS NULL OR file_size > 0)
);

-- Create project_applications table
CREATE TABLE public.project_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  status application_status DEFAULT 'pending',
  proposal TEXT,
  quoted_price DECIMAL(12,2),
  estimated_duration TEXT, -- e.g., '3 months', '6 weeks'
  cover_letter TEXT,
  portfolio_items TEXT[], -- Array of portfolio URLs/references
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT project_applications_proposal_length CHECK (proposal IS NULL OR length(proposal) <= 2000),
  CONSTRAINT project_applications_cover_letter_length CHECK (cover_letter IS NULL OR length(cover_letter) <= 1000),
  CONSTRAINT project_applications_quoted_price_positive CHECK (quoted_price IS NULL OR quoted_price > 0),
  CONSTRAINT project_applications_dates_valid CHECK (
    (applied_at IS NULL OR responded_at IS NULL) OR
    (applied_at <= responded_at)
  ),

  -- Unique constraint to prevent duplicate applications
  CONSTRAINT project_applications_unique UNIQUE (project_id, professional_id)
);

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_applications ENABLE ROW LEVEL SECURITY;

-- Create updated_at triggers
CREATE TRIGGER handle_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_project_photos_updated_at
  BEFORE UPDATE ON public.project_photos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_project_applications_updated_at
  BEFORE UPDATE ON public.project_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to ensure only one primary photo per project
CREATE OR REPLACE FUNCTION public.ensure_single_primary_photo()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this photo as primary, unset all other primary photos for this project
  IF NEW.is_primary = TRUE THEN
    UPDATE public.project_photos
    SET is_primary = FALSE
    WHERE project_id = NEW.project_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_primary_photo_trigger
  BEFORE INSERT OR UPDATE ON public.project_photos
  FOR EACH ROW
  WHEN (NEW.is_primary = TRUE)
  EXECUTE FUNCTION public.ensure_single_primary_photo();

-- Function to generate slug from title
CREATE OR REPLACE FUNCTION public.generate_project_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate slug if not provided
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'));
    NEW.slug := trim(both '-' from NEW.slug);

    -- Ensure uniqueness by appending number if needed
    DECLARE
      base_slug TEXT := NEW.slug;
      counter INTEGER := 1;
    BEGIN
      WHILE EXISTS (SELECT 1 FROM public.projects WHERE slug = NEW.slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) LOOP
        NEW.slug := base_slug || '-' || counter;
        counter := counter + 1;
      END LOOP;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_project_slug_trigger
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.generate_project_slug();

-- Add indexes
CREATE INDEX idx_projects_client_id ON public.projects(client_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_location ON public.projects(location) WHERE location IS NOT NULL;
CREATE INDEX idx_projects_budget ON public.projects(budget_min, budget_max) WHERE budget_min IS NOT NULL;
CREATE INDEX idx_projects_slug ON public.projects(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_projects_featured ON public.projects(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_projects_created_at ON public.projects(created_at DESC);

-- Full-text search index for projects
CREATE INDEX idx_projects_search ON public.projects USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

CREATE INDEX idx_project_photos_project_id ON public.project_photos(project_id);
CREATE INDEX idx_project_photos_order ON public.project_photos(project_id, order_index);
CREATE INDEX idx_project_photos_primary ON public.project_photos(project_id) WHERE is_primary = TRUE;

CREATE INDEX idx_project_applications_project_id ON public.project_applications(project_id);
CREATE INDEX idx_project_applications_professional_id ON public.project_applications(professional_id);
CREATE INDEX idx_project_applications_status ON public.project_applications(status);
CREATE INDEX idx_project_applications_applied_at ON public.project_applications(applied_at DESC);

-- Add comments
COMMENT ON TABLE public.projects IS 'Project listings and details';
COMMENT ON TABLE public.project_photos IS 'Photos associated with projects';
COMMENT ON TABLE public.project_applications IS 'Professional applications to projects';

COMMENT ON COLUMN public.projects.client_id IS 'User who created this project';
COMMENT ON COLUMN public.projects.style_preferences IS 'Array of preferred architectural/design styles';
COMMENT ON COLUMN public.projects.features IS 'Array of desired project features';
COMMENT ON COLUMN public.projects.slug IS 'URL-friendly identifier for the project';

COMMENT ON COLUMN public.project_photos.is_primary IS 'Whether this is the main photo for the project';
COMMENT ON COLUMN public.project_photos.order_index IS 'Order for photo gallery display';
COMMENT ON COLUMN public.project_photos.storage_path IS 'Path in Supabase Storage';

COMMENT ON COLUMN public.project_applications.professional_id IS 'Professional applying to the project';
COMMENT ON COLUMN public.project_applications.portfolio_items IS 'Array of portfolio URLs/references';
