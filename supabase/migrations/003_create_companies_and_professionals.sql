-- Migration: Create companies and professionals tables
-- Description: Company information and professional profiles

-- Create companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  website TEXT,
  logo_url TEXT,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'Netherlands',
  phone TEXT,
  email TEXT,
  founded_year INTEGER,
  team_size_min INTEGER,
  team_size_max INTEGER,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT companies_name_length CHECK (length(name) >= 2),
  CONSTRAINT companies_description_length CHECK (description IS NULL OR length(description) <= 2000),
  CONSTRAINT companies_founded_year_valid CHECK (founded_year IS NULL OR (founded_year >= 1800 AND founded_year <= EXTRACT(YEAR FROM NOW()))),
  CONSTRAINT companies_team_size_valid CHECK (
    (team_size_min IS NULL AND team_size_max IS NULL) OR
    (team_size_min IS NOT NULL AND team_size_max IS NOT NULL AND team_size_min <= team_size_max AND team_size_min > 0)
  ),
  CONSTRAINT companies_email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create professionals table
CREATE TABLE public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  bio TEXT,
  years_experience INTEGER,
  hourly_rate_min DECIMAL(10,2),
  hourly_rate_max DECIMAL(10,2),
  portfolio_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_available BOOLEAN DEFAULT TRUE,
  services_offered TEXT[],
  languages_spoken TEXT[] DEFAULT ARRAY['Dutch', 'English'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT professionals_title_length CHECK (length(title) >= 2),
  CONSTRAINT professionals_bio_length CHECK (bio IS NULL OR length(bio) <= 2000),
  CONSTRAINT professionals_experience_valid CHECK (years_experience IS NULL OR (years_experience >= 0 AND years_experience <= 60)),
  CONSTRAINT professionals_hourly_rate_valid CHECK (
    (hourly_rate_min IS NULL AND hourly_rate_max IS NULL) OR
    (hourly_rate_min IS NOT NULL AND hourly_rate_max IS NOT NULL AND
     hourly_rate_min >= 0 AND hourly_rate_max >= hourly_rate_min)
  ),

  -- Unique constraint to ensure one professional profile per user
  CONSTRAINT professionals_user_unique UNIQUE (user_id)
);

-- Create professional ratings table for aggregated data
CREATE TABLE public.professional_ratings (
  professional_id UUID PRIMARY KEY REFERENCES public.professionals(id) ON DELETE CASCADE,
  overall_rating DECIMAL(3,2) DEFAULT 0,
  quality_rating DECIMAL(3,2) DEFAULT 0,
  reliability_rating DECIMAL(3,2) DEFAULT 0,
  communication_rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  last_review_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints for rating ranges
  CONSTRAINT rating_overall_range CHECK (overall_rating >= 0 AND overall_rating <= 5),
  CONSTRAINT rating_quality_range CHECK (quality_rating >= 0 AND quality_rating <= 5),
  CONSTRAINT rating_reliability_range CHECK (reliability_rating >= 0 AND reliability_rating <= 5),
  CONSTRAINT rating_communication_range CHECK (communication_rating >= 0 AND communication_rating <= 5),
  CONSTRAINT total_reviews_positive CHECK (total_reviews >= 0)
);

-- Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_ratings ENABLE ROW LEVEL SECURITY;

-- Create updated_at triggers
CREATE TRIGGER handle_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_professionals_updated_at
  BEFORE UPDATE ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_professional_ratings_updated_at
  BEFORE UPDATE ON public.professional_ratings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create trigger to automatically create professional ratings entry
CREATE OR REPLACE FUNCTION public.handle_new_professional()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.professional_ratings (professional_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_professional_created
  AFTER INSERT ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_professional();

-- Add indexes
CREATE INDEX idx_companies_owner_id ON public.companies(owner_id);
CREATE INDEX idx_companies_city ON public.companies(city) WHERE city IS NOT NULL;
CREATE INDEX idx_companies_verified ON public.companies(is_verified) WHERE is_verified = TRUE;

CREATE INDEX idx_professionals_user_id ON public.professionals(user_id);
CREATE INDEX idx_professionals_company_id ON public.professionals(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_professionals_verified ON public.professionals(is_verified) WHERE is_verified = TRUE;
CREATE INDEX idx_professionals_available ON public.professionals(is_available) WHERE is_available = TRUE;
CREATE INDEX idx_professionals_hourly_rate ON public.professionals(hourly_rate_min, hourly_rate_max) WHERE hourly_rate_min IS NOT NULL;

-- Add comments
COMMENT ON TABLE public.companies IS 'Company information for professional organizations';
COMMENT ON TABLE public.professionals IS 'Professional profiles for service providers';
COMMENT ON TABLE public.professional_ratings IS 'Aggregated rating data for professionals';

COMMENT ON COLUMN public.companies.owner_id IS 'User who owns/manages this company';
COMMENT ON COLUMN public.professionals.user_id IS 'User this professional profile belongs to';
COMMENT ON COLUMN public.professionals.company_id IS 'Company this professional is associated with';
COMMENT ON COLUMN public.professionals.services_offered IS 'Array of services this professional offers';
COMMENT ON COLUMN public.professionals.languages_spoken IS 'Array of languages this professional speaks';
