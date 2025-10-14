-- Migration: Add profile avatar support
-- Description: Creates a dedicated storage bucket with policies and metadata for user profile photos.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_storage_path text;

COMMENT ON COLUMN public.profiles.avatar_storage_path IS 'Supabase Storage path for the users profile avatar.';

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET
  file_size_limit = 5242880, -- 5 MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'],
  public = TRUE
WHERE id = 'profile-photos';

DROP POLICY IF EXISTS "Profile avatars are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their avatar" ON storage.objects;

DROP FUNCTION IF EXISTS public.is_own_profile_avatar_path(text);
CREATE OR REPLACE FUNCTION public.is_own_profile_avatar_path(_path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  segments text[];
  owner_segment text;
  filename text;
  extension text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF _path IS NULL OR length(_path) = 0 THEN
    RETURN FALSE;
  END IF;

  segments := string_to_array(_path, '/');

  IF array_length(segments, 1) != 2 THEN
    RETURN FALSE;
  END IF;

  owner_segment := segments[1];
  filename := segments[2];

  IF owner_segment IS NULL OR filename IS NULL OR filename = '' THEN
    RETURN FALSE;
  END IF;

  IF owner_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN FALSE;
  END IF;

  IF position('.' IN filename) = 0 THEN
    RETURN FALSE;
  END IF;

  IF filename LIKE '%/%' OR filename LIKE '%..%' THEN
    RETURN FALSE;
  END IF;

  extension := lower(split_part(filename, '.', 2));

  IF extension IS NULL OR extension NOT IN ('jpg', 'jpeg', 'png', 'webp') THEN
    RETURN FALSE;
  END IF;

  IF owner_segment::uuid <> auth.uid() THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

CREATE POLICY "Profile avatars are publicly readable" ON storage.objects
FOR SELECT
USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can upload their avatar" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'profile-photos'
  AND auth.role() = 'authenticated'
  AND public.is_own_profile_avatar_path(name)
);

CREATE POLICY "Users can update their avatar" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'profile-photos'
  AND auth.role() = 'authenticated'
  AND public.is_own_profile_avatar_path(name)
)
WITH CHECK (
  bucket_id = 'profile-photos'
  AND public.is_own_profile_avatar_path(name)
);

CREATE POLICY "Users can delete their avatar" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'profile-photos'
  AND auth.role() = 'authenticated'
  AND public.is_own_profile_avatar_path(name)
);

COMMIT;
