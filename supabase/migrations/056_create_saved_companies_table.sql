-- Migration: Create saved_companies table
-- Purpose: Migrate from professional-centric to company-centric saved items
-- Date: 2025-10-24

-- Create new table
CREATE TABLE public.saved_companies (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (user_id, company_id),
  CONSTRAINT saved_companies_notes_length CHECK (notes IS NULL OR length(notes) <= 500)
);

-- Create indexes
CREATE INDEX idx_saved_companies_user_id ON public.saved_companies(user_id);
CREATE INDEX idx_saved_companies_created_at ON public.saved_companies(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.saved_companies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY saved_companies_user_select ON public.saved_companies
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY saved_companies_user_insert ON public.saved_companies
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_companies_user_delete ON public.saved_companies
  FOR DELETE USING (user_id = auth.uid());

-- Migrate existing data from saved_professionals
INSERT INTO public.saved_companies (user_id, company_id, notes, created_at)
SELECT 
  sp.user_id,
  p.company_id,
  sp.notes,
  sp.created_at
FROM public.saved_professionals sp
JOIN public.professionals p ON p.id = sp.professional_id
WHERE p.company_id IS NOT NULL
ON CONFLICT (user_id, company_id) DO NOTHING;

-- Add comment
COMMENT ON TABLE public.saved_companies IS 'Companies saved by users for later reference. Replaces saved_professionals table.';
