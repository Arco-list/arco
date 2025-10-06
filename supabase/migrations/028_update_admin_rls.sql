-- Migration: Ensure admins can preview and manage projects
-- Description: Updates RLS policies so admin users can read draft assets and approve projects

-- Allow admins to read non-published projects
ALTER POLICY projects_public_read ON public.projects
USING (
  (status = 'published'::project_status)
  OR (auth.uid() = client_id)
  OR EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = auth.uid()
          AND COALESCE(p.user_types, '{}'::text[]) @> ARRAY['admin']::text[]
      )
);

-- Allow admins to update projects (approve/reject)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'projects'
      AND policyname = 'projects_admin_update'
  ) THEN
    EXECUTE $$CREATE POLICY projects_admin_update ON public.projects
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = auth.uid()
          AND COALESCE(p.user_types, '{}'::text[]) @> ARRAY['admin']::text[]
      )
    )
    WITH CHECK (TRUE)$$;
  END IF;
END$$;

-- Allow admins to read project photos when previewing
ALTER POLICY project_photos_public_read ON public.project_photos
USING (
  project_id IN (
    SELECT projects.id
    FROM public.projects
    WHERE
      projects.status = 'published'::project_status
      OR projects.client_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = auth.uid()
          AND COALESCE(p.user_types, '{}'::text[]) @> ARRAY['admin']::text[]
      )
  )
);

-- Helper to create admin read policies if missing
CREATE OR REPLACE FUNCTION public.__ensure_admin_read_policy(
  target_table text,
  policy_name text
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = target_table
      AND policyname = policy_name
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (
         EXISTS (
           SELECT 1 FROM public.profiles AS p
           WHERE p.id = auth.uid()
             AND COALESCE(p.user_types, ''{}''::text[]) @> ARRAY[''admin''::text[]]
         )
       )',
      policy_name,
      target_table
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT public.__ensure_admin_read_policy('project_features', 'project_features_admin_read');
SELECT public.__ensure_admin_read_policy('project_professional_services', 'project_professional_services_admin_read');
SELECT public.__ensure_admin_read_policy('project_professionals', 'project_professionals_admin_read');

DROP FUNCTION public.__ensure_admin_read_policy(text, text);
