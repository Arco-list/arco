-- Fix: project_professionals.company_id FK should CASCADE on company delete
-- The original migration (068) specified CASCADE but the DB has NO ACTION.
-- This prevents company deletion when project_professionals rows exist.

ALTER TABLE public.project_professionals
  DROP CONSTRAINT IF EXISTS project_professionals_company_id_fkey;

ALTER TABLE public.project_professionals
  ADD CONSTRAINT project_professionals_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
