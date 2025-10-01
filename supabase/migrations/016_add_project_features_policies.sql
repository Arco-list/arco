-- Migration: Add RLS policies for project_features
-- Description: Grants project owners permission to manage their feature records.

BEGIN;

-- Remove any legacy policies before recreating
DROP POLICY IF EXISTS "Project features owner select" ON public.project_features;
DROP POLICY IF EXISTS "Project features owner insert" ON public.project_features;
DROP POLICY IF EXISTS "Project features owner update" ON public.project_features;
DROP POLICY IF EXISTS "Project features owner delete" ON public.project_features;

CREATE POLICY "Project features owner select" ON public.project_features
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_features.project_id
      AND p.client_id = auth.uid()
  )
);

CREATE POLICY "Project features owner insert" ON public.project_features
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_features.project_id
      AND p.client_id = auth.uid()
  )
);

CREATE POLICY "Project features owner update" ON public.project_features
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_features.project_id
      AND p.client_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_features.project_id
      AND p.client_id = auth.uid()
  )
);

CREATE POLICY "Project features owner delete" ON public.project_features
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_features.project_id
      AND p.client_id = auth.uid()
  )
);

COMMIT;
