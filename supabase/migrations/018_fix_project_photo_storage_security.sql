-- Migration: Fix project photo storage security vulnerability
-- Issue: Migration 017 relies on client-provided metadata which can be spoofed
-- Solution: Create a new SECURITY DEFINER function that validates the storage path
--           instead of trusting client metadata
--
-- Security Context:
-- The previous approach allowed clients to set arbitrary metadata.project_id,
-- creating a risk where malicious users could potentially upload files with
-- incorrect project associations (though still limited to projects they own).
--
-- This migration introduces path-based validation which is immutable and
-- controlled by the upload logic, not the client.

BEGIN;

-- Create a new helper function that validates based on storage path
-- Path format: {project_id}/{file_id}
CREATE OR REPLACE FUNCTION public.is_project_photo_owner_by_path(_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = split_part(_path, '/', 1)::uuid
      AND p.client_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_project_photo_owner_by_path IS
'Validates project ownership by extracting project_id from storage path.
This is more secure than relying on client-provided metadata.';

-- Update the INSERT policy to use path-based validation
DROP POLICY IF EXISTS "Project owners can upload photos" ON storage.objects;
CREATE POLICY "Project owners can upload photos" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'project-photos'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_project_photo_owner_by_path(name)
);

-- Update the UPDATE policy to use path-based validation
DROP POLICY IF EXISTS "Project owners can update photos" ON storage.objects;
CREATE POLICY "Project owners can update photos" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'project-photos'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_project_photo_owner_by_path(name)
)
WITH CHECK (
  bucket_id = 'project-photos'
  AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_project_photo_owner_by_path(name)
);

-- Update the DELETE policy to use path-based validation
DROP POLICY IF EXISTS "Project owners can delete photos" ON storage.objects;
CREATE POLICY "Project owners can delete photos" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'project-photos'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_project_photo_owner_by_path(name)
);

-- Keep the old metadata-based function for backward compatibility
-- but mark it as deprecated
COMMENT ON FUNCTION public.is_project_photo_owner IS
'DEPRECATED: Use is_project_photo_owner_by_path instead.
This function relies on client-provided metadata which can be spoofed.';

COMMIT;
