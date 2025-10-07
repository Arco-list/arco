-- Migration: Expand public read access for project detail dependencies
-- Description: Allows anonymous visitors to read published project metadata without requiring the service role.

BEGIN;

DROP POLICY IF EXISTS project_features_public_read ON public.project_features;
CREATE POLICY project_features_public_read ON public.project_features
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.projects AS p
      WHERE p.id = project_features.project_id
        AND p.status = 'published'::project_status
    )
  );

DROP POLICY IF EXISTS project_professional_services_public_read ON public.project_professional_services;
CREATE POLICY project_professional_services_public_read ON public.project_professional_services
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.projects AS p
      WHERE p.id = project_professional_services.project_id
        AND (
          p.status = 'published'::project_status
          OR p.client_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS project_professionals_owner_read ON public.project_professionals;
CREATE POLICY project_professionals_owner_read ON public.project_professionals
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.projects AS p
      WHERE p.id = project_professionals.project_id
        AND p.client_id = auth.uid()
    )
  );

COMMIT;
