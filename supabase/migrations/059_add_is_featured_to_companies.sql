-- Add is_featured field to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for filtering featured companies
CREATE INDEX IF NOT EXISTS idx_companies_is_featured
ON public.companies (is_featured)
WHERE is_featured = TRUE;

-- Add comment
COMMENT ON COLUMN public.companies.is_featured IS 'Whether this company should be featured on the homepage';
