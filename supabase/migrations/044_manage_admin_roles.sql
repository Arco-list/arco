-- Migration: Manage admin roles and normalize profile user types
-- Description: Introduces admin_role enum, converts legacy user_type column to user_types array,
--              seeds initial super admin, and updates helper functions for admin checks.

BEGIN;

-- Create admin_role enum if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_role') THEN
    CREATE TYPE public.admin_role AS ENUM ('super_admin', 'admin');
    COMMENT ON TYPE public.admin_role IS 'Administrative roles for internal portal access';
  END IF;
END
$$;

-- Ensure user_types array column exists and backfill from legacy user_type column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_types TEXT[] DEFAULT ARRAY['client']::TEXT[];

-- Populate missing user_types from legacy user_type column when available
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'user_type'
  ) THEN
    EXECUTE $sql$
      UPDATE public.profiles
      SET user_types = ARRAY[COALESCE(user_type::TEXT, 'client')]
      WHERE (user_types IS NULL OR cardinality(user_types) = 0)
        AND user_type IS NOT NULL;
    $sql$;
  END IF;
END;
$$;

-- Ensure every profile has at least one user type
UPDATE public.profiles
SET user_types = ARRAY['client']
WHERE user_types IS NULL
   OR cardinality(user_types) = 0;

-- Add admin-specific metadata columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_role public.admin_role,
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.admin_role IS 'Administrative role assigned to the user for internal tooling';
COMMENT ON COLUMN public.profiles.invited_by IS 'Auth user id of the admin who invited this admin user';
COMMENT ON COLUMN public.profiles.invited_at IS 'Timestamp when the admin invitation email was issued';

-- Drop legacy user_type column and associated artifacts if present
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS user_type;

DROP INDEX IF EXISTS idx_profiles_user_type;

-- Create a helper index for querying by user types
CREATE INDEX IF NOT EXISTS idx_profiles_user_types ON public.profiles USING GIN (user_types);

-- Refresh handle_new_user trigger logic to populate the array + admin role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  metadata_user_types TEXT[];
  admin_role_text TEXT;
  normalized_types TEXT[];
  admin_role_value public.admin_role;
BEGIN
  metadata_user_types := ARRAY[]::TEXT[];

  IF NEW.raw_user_meta_data ? 'user_types' THEN
    IF jsonb_typeof(NEW.raw_user_meta_data -> 'user_types') = 'array' THEN
      SELECT ARRAY_AGG(DISTINCT LOWER(TRIM(value)))
      INTO metadata_user_types
      FROM jsonb_array_elements_text(NEW.raw_user_meta_data -> 'user_types') AS value
      WHERE TRIM(value) <> '';
    ELSE
      metadata_user_types := ARRAY[LOWER(TRIM(NEW.raw_user_meta_data ->> 'user_types'))];
    END IF;
  ELSIF NEW.raw_user_meta_data ? 'user_type' THEN
    metadata_user_types := ARRAY[LOWER(TRIM(NEW.raw_user_meta_data ->> 'user_type'))];
  END IF;

  metadata_user_types := ARRAY(
    SELECT DISTINCT v
    FROM unnest(COALESCE(metadata_user_types, ARRAY[]::TEXT[])) AS v
    WHERE v IS NOT NULL AND v <> ''
  );

  IF metadata_user_types IS NULL OR cardinality(metadata_user_types) = 0 THEN
    metadata_user_types := ARRAY['client'];
  END IF;

  admin_role_text := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'admin_role', '')));

  IF admin_role_text = 'super_admin' THEN
    admin_role_value := 'super_admin';
  ELSIF admin_role_text = 'admin' THEN
    admin_role_value := 'admin';
  ELSE
    admin_role_value := NULL;
  END IF;

  IF admin_role_value IS NOT NULL THEN
    metadata_user_types := ARRAY(
      SELECT DISTINCT v
      FROM unnest(metadata_user_types || ARRAY['admin']) AS v
    );
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, user_types, admin_role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    metadata_user_types,
    admin_role_value
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update is_admin helper to rely on the array column
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = TRUE
      AND COALESCE(user_types, ARRAY[]::TEXT[]) @> ARRAY['admin']
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed admin_role based on current user_types (if missing)
UPDATE public.profiles
SET admin_role = CASE
  WHEN admin_role IS NOT NULL THEN admin_role
  ELSE 'admin'
END
WHERE admin_role IS NULL
  AND COALESCE(user_types, ARRAY[]::TEXT[]) @> ARRAY['admin'];

-- Guarantee an initial super admin using the provided email if present
WITH target_user AS (
  SELECT u.id
  FROM auth.users u
  WHERE LOWER(u.email) = 'bartek+admin@tinkso.com'
  LIMIT 1
),
updated AS (
  UPDATE public.profiles p
  SET admin_role = 'super_admin',
      user_types = ARRAY(
        SELECT DISTINCT v
        FROM unnest(COALESCE(p.user_types, ARRAY[]::TEXT[]) || ARRAY['admin']) AS v
      )
  WHERE p.id = (SELECT id FROM target_user)
  RETURNING p.id
)
UPDATE public.profiles p
SET admin_role = 'super_admin'
WHERE admin_role IS NULL
  AND COALESCE(user_types, ARRAY[]::TEXT[]) @> ARRAY['admin']
  AND NOT EXISTS (SELECT 1 FROM updated)
  AND p.id IN (
    SELECT id
    FROM public.profiles
    WHERE COALESCE(user_types, ARRAY[]::TEXT[]) @> ARRAY['admin']
    ORDER BY created_at
    LIMIT 1
  );

COMMIT;
