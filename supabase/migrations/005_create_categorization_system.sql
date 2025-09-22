-- Migration: Create categorization system
-- Description: Categories and specialties for organizing professionals and projects

-- Create categories table for service categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT, -- Icon name or URL for UI display
  color TEXT, -- Hex color for UI theming
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT categories_name_length CHECK (length(name) >= 2),
  CONSTRAINT categories_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT categories_description_length CHECK (description IS NULL OR length(description) <= 1000),
  CONSTRAINT categories_color_format CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT categories_sort_order_positive CHECK (sort_order >= 0),
  -- Prevent self-reference
  CONSTRAINT categories_no_self_reference CHECK (id != parent_id)
);

-- Create professional_specialties junction table
CREATE TABLE public.professional_specialties (
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  years_experience INTEGER,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (professional_id, category_id),

  -- Constraints
  CONSTRAINT professional_specialties_experience_valid CHECK (years_experience IS NULL OR (years_experience >= 0 AND years_experience <= 60))
);

-- Create project_categories junction table
CREATE TABLE public.project_categories (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (project_id, category_id)
);

-- Enable RLS on all tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_categories ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger for categories
CREATE TRIGGER handle_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to generate category slug
CREATE OR REPLACE FUNCTION public.generate_category_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate slug if not provided
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
    NEW.slug := trim(both '-' from NEW.slug);

    -- Ensure uniqueness by appending number if needed
    DECLARE
      base_slug TEXT := NEW.slug;
      counter INTEGER := 1;
    BEGIN
      WHILE EXISTS (SELECT 1 FROM public.categories WHERE slug = NEW.slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) LOOP
        NEW.slug := base_slug || '-' || counter;
        counter := counter + 1;
      END LOOP;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_category_slug_trigger
  BEFORE INSERT OR UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.generate_category_slug();

-- Function to ensure only one primary specialty per professional
CREATE OR REPLACE FUNCTION public.ensure_single_primary_specialty()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this specialty as primary, unset all other primary specialties for this professional
  IF NEW.is_primary = TRUE THEN
    UPDATE public.professional_specialties
    SET is_primary = FALSE
    WHERE professional_id = NEW.professional_id AND category_id != NEW.category_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_primary_specialty_trigger
  BEFORE INSERT OR UPDATE ON public.professional_specialties
  FOR EACH ROW
  WHEN (NEW.is_primary = TRUE)
  EXECUTE FUNCTION public.ensure_single_primary_specialty();

-- Function to ensure only one primary category per project
CREATE OR REPLACE FUNCTION public.ensure_single_primary_project_category()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this category as primary, unset all other primary categories for this project
  IF NEW.is_primary = TRUE THEN
    UPDATE public.project_categories
    SET is_primary = FALSE
    WHERE project_id = NEW.project_id AND category_id != NEW.category_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_primary_project_category_trigger
  BEFORE INSERT OR UPDATE ON public.project_categories
  FOR EACH ROW
  WHEN (NEW.is_primary = TRUE)
  EXECUTE FUNCTION public.ensure_single_primary_project_category();

-- Add indexes
CREATE INDEX idx_categories_slug ON public.categories(slug);
CREATE INDEX idx_categories_parent_id ON public.categories(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_categories_active ON public.categories(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_categories_sort_order ON public.categories(sort_order);

CREATE INDEX idx_professional_specialties_professional ON public.professional_specialties(professional_id);
CREATE INDEX idx_professional_specialties_category ON public.professional_specialties(category_id);
CREATE INDEX idx_professional_specialties_primary ON public.professional_specialties(professional_id) WHERE is_primary = TRUE;

CREATE INDEX idx_project_categories_project ON public.project_categories(project_id);
CREATE INDEX idx_project_categories_category ON public.project_categories(category_id);
CREATE INDEX idx_project_categories_primary ON public.project_categories(project_id) WHERE is_primary = TRUE;

-- Insert initial categories based on UI analysis
INSERT INTO public.categories (name, slug, description, icon, color, sort_order) VALUES
-- Main Professional Categories
('Architecture', 'architecture', 'Architectural design and planning services', 'building', '#2563eb', 1),
('Interior Design', 'interior-design', 'Interior space design and decoration', 'home', '#7c3aed', 2),
('Construction', 'construction', 'General construction and building services', 'hammer', '#dc2626', 3),
('Landscaping', 'landscaping', 'Garden and outdoor space design', 'tree-pine', '#059669', 4),
('Home Automation', 'home-automation', 'Smart home and automation systems', 'zap', '#ea580c', 5),
('Lighting Design', 'lighting-design', 'Architectural and interior lighting', 'lightbulb', '#facc15', 6),
('Kitchen Design', 'kitchen-design', 'Kitchen planning and design', 'chef-hat', '#8b5cf6', 7),
('Bathroom Design', 'bathroom-design', 'Bathroom renovation and design', 'droplets', '#06b6d4', 8),

-- Project Types (sub-categories)
('Residential', 'residential', 'Residential projects and homes', 'house', '#1d4ed8', 10),
('Commercial', 'commercial', 'Commercial and office spaces', 'building-office', '#0f766e', 11),
('Renovation', 'renovation', 'Renovation and remodeling projects', 'wrench', '#c2410c', 12),
('New Construction', 'new-construction', 'New building construction projects', 'plus-square', '#16a34a', 13);

-- Insert specialty subcategories
INSERT INTO public.categories (name, slug, description, parent_id, sort_order) VALUES
-- Architecture subcategories
('Modern Architecture', 'modern-architecture', 'Contemporary and modern architectural styles',
  (SELECT id FROM public.categories WHERE slug = 'architecture'), 1),
('Sustainable Design', 'sustainable-design', 'Eco-friendly and sustainable building design',
  (SELECT id FROM public.categories WHERE slug = 'architecture'), 2),
('Historic Restoration', 'historic-restoration', 'Restoration of historic buildings',
  (SELECT id FROM public.categories WHERE slug = 'architecture'), 3),

-- Interior Design subcategories
('Luxury Interiors', 'luxury-interiors', 'High-end luxury interior design',
  (SELECT id FROM public.categories WHERE slug = 'interior-design'), 1),
('Color Consulting', 'color-consulting', 'Professional color consultation services',
  (SELECT id FROM public.categories WHERE slug = 'interior-design'), 2),
('Space Planning', 'space-planning', 'Optimal space layout and planning',
  (SELECT id FROM public.categories WHERE slug = 'interior-design'), 3),

-- Construction subcategories
('Renovations', 'renovations', 'Home and building renovation services',
  (SELECT id FROM public.categories WHERE slug = 'construction'), 1),
('Custom Homes', 'custom-homes', 'Custom home building services',
  (SELECT id FROM public.categories WHERE slug = 'construction'), 2),

-- Landscaping subcategories
('Garden Design', 'garden-design', 'Garden planning and design services',
  (SELECT id FROM public.categories WHERE slug = 'landscaping'), 1),
('Outdoor Spaces', 'outdoor-spaces', 'Outdoor living space design',
  (SELECT id FROM public.categories WHERE slug = 'landscaping'), 2);

-- Add comments
COMMENT ON TABLE public.categories IS 'Service categories and project types';
COMMENT ON TABLE public.professional_specialties IS 'Junction table for professional specialties';
COMMENT ON TABLE public.project_categories IS 'Junction table for project categories';

COMMENT ON COLUMN public.categories.parent_id IS 'Parent category for hierarchical organization';
COMMENT ON COLUMN public.categories.slug IS 'URL-friendly identifier';
COMMENT ON COLUMN public.categories.icon IS 'Icon identifier for UI display';
COMMENT ON COLUMN public.categories.color IS 'Hex color for UI theming';
COMMENT ON COLUMN public.categories.sort_order IS 'Display order within parent category';

COMMENT ON COLUMN public.professional_specialties.is_primary IS 'Whether this is the professionals primary specialty';
COMMENT ON COLUMN public.professional_specialties.years_experience IS 'Years of experience in this specialty';

COMMENT ON COLUMN public.project_categories.is_primary IS 'Whether this is the projects primary category';