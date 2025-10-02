-- Migration: Harden project photo policies by relying on metadata

BEGIN;

-- Backfill metadata for existing objects so the new policies continue to work.
UPDATE storage.objects
SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('project_id', split_part(name, '/', 1))
WHERE bucket_id = 'project-photos'
  AND (metadata ->> 'project_id') IS NULL
  AND position('/' IN name) > 0;

-- Ensure we have the owner helper available.
CREATE OR REPLACE FUNCTION public.is_project_photo_owner(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = _project_id
      AND p.client_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Project owners can upload photos" ON storage.objects;
CREATE POLICY "Project owners can upload photos" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'project-photos'
  AND auth.role() = 'authenticated'
  AND (metadata ->> 'project_id') IS NOT NULL
  AND (metadata ->> 'project_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_project_photo_owner((metadata ->> 'project_id')::uuid)
);

DROP POLICY IF EXISTS "Project owners can update photos" ON storage.objects;
CREATE POLICY "Project owners can update photos" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'project-photos'
  AND auth.role() = 'authenticated'
  AND (metadata ->> 'project_id') IS NOT NULL
  AND (metadata ->> 'project_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_project_photo_owner((metadata ->> 'project_id')::uuid)
)
WITH CHECK (
  bucket_id = 'project-photos'
  AND (metadata ->> 'project_id') IS NOT NULL
  AND (metadata ->> 'project_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_project_photo_owner((metadata ->> 'project_id')::uuid)
);

DROP POLICY IF EXISTS "Project owners can delete photos" ON storage.objects;
CREATE POLICY "Project owners can delete photos" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'project-photos'
  AND auth.role() = 'authenticated'
  AND (metadata ->> 'project_id') IS NOT NULL
  AND (metadata ->> 'project_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_project_photo_owner((metadata ->> 'project_id')::uuid)
);

COMMIT;
