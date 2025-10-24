-- Migration: Add company_id to project_professionals table
-- Description: Update project_professionals to reference companies instead of just professionals

-- Step 1: Add company_id column (nullable initially)
ALTER TABLE public.project_professionals
  ADD COLUMN IF NOT EXISTS company_id UUID;

-- Step 2: Migrate existing data - get company_id from professionals table
UPDATE public.project_professionals pp
SET company_id = p.company_id
FROM public.professionals p
WHERE pp.professional_id = p.id
  AND pp.company_id IS NULL;

-- Step 3: Add foreign key constraint
ALTER TABLE public.project_professionals
  ADD CONSTRAINT project_professionals_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- Step 4: Create index for company_id lookups
CREATE INDEX IF NOT EXISTS idx_project_professionals_company
  ON public.project_professionals(company_id);

-- Step 5: Update table comment
COMMENT ON COLUMN public.project_professionals.company_id IS 'The company associated with this professional on the project';
