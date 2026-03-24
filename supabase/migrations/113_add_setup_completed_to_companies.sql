-- Add setup_completed flag to companies
-- When false, the company edit page shows setup mode until all required fields are filled and company is published
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS setup_completed boolean NOT NULL DEFAULT false;

-- Mark existing listed companies as setup completed
UPDATE public.companies SET setup_completed = true WHERE status = 'listed';
