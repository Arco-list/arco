-- Migration: Create project-photos storage bucket and policies
-- Description: Ensures public read access while restricting writes to project owners.

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-photos', 'project-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Project photos are publicly readable" ON storage.objects;
CREATE POLICY "Project photos are publicly readable" ON storage.objects
FOR SELECT
USING (bucket_id = 'project-photos');

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
  AND public.is_project_photo_owner(split_part(name, '/', 1)::uuid)
);

DROP POLICY IF EXISTS "Project owners can update photos" ON storage.objects;
CREATE POLICY "Project owners can update photos" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'project-photos'
  AND auth.role() = 'authenticated'
  AND public.is_project_photo_owner(split_part(name, '/', 1)::uuid)
)
WITH CHECK (
  bucket_id = 'project-photos'
  AND public.is_project_photo_owner(split_part(name, '/', 1)::uuid)
);

DROP POLICY IF EXISTS "Project owners can delete photos" ON storage.objects;
CREATE POLICY "Project owners can delete photos" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'project-photos'
  AND auth.role() = 'authenticated'
  AND public.is_project_photo_owner(split_part(name, '/', 1)::uuid)
);

COMMIT;
