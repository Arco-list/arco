-- Migration: Link projects.project_type to categories via foreign key
-- Description: Adds project_type_category_id column, backfills existing data, and enforces FK

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN project_type_category_id UUID;

-- Populate from existing UUID-like values in project_type column
UPDATE public.projects
SET project_type_category_id = project_type::uuid
WHERE project_type IS NOT NULL
  AND project_type ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Populate from matching category slug or name when UUID not available
UPDATE public.projects AS p
SET project_type_category_id = c.id
FROM public.categories AS c
WHERE p.project_type_category_id IS NULL
  AND p.project_type IS NOT NULL
  AND btrim(p.project_type) <> ''
  AND (
    lower(p.project_type) = lower(c.slug)
    OR lower(p.project_type) = lower(c.name)
  );

-- Ensure referential integrity for future writes
ALTER TABLE public.projects
  ADD CONSTRAINT projects_project_type_category_id_fkey
  FOREIGN KEY (project_type_category_id)
  REFERENCES public.categories(id)
  ON DELETE SET NULL
  NOT VALID;

ALTER TABLE public.projects
  VALIDATE CONSTRAINT projects_project_type_category_id_fkey;

CREATE INDEX IF NOT EXISTS idx_projects_project_type_category_id
  ON public.projects(project_type_category_id);

COMMIT;
