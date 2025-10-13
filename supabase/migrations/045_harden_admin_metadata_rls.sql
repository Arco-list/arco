-- Migration: Harden RLS for admin metadata on profiles
-- Description: Restrict public access to admin-specific rows and prevent privilege escalation via self-updates.

BEGIN;

-- Ensure non-admin users cannot read admin profiles via the public policy
ALTER POLICY profiles_public_read ON public.profiles
  USING (
    is_active = TRUE
    AND NOT (COALESCE(user_types, ARRAY[]::text[]) @> ARRAY['admin']::text[])
  );

-- Allow admins to read all profiles (including other admins)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_admin_read'
  ) THEN
    CREATE POLICY profiles_admin_read ON public.profiles
      FOR SELECT
      USING (public.is_admin());
  END IF;
END;
$$;

-- Prevent regular users from self-assigning admin privileges or manipulating admin metadata
ALTER POLICY profiles_own_update ON public.profiles
  USING (
    auth.uid() = id
    AND NOT (COALESCE(user_types, ARRAY[]::text[]) @> ARRAY['admin']::text[])
  )
  WITH CHECK (
    auth.uid() = id
    AND NOT (COALESCE(user_types, ARRAY[]::text[]) @> ARRAY['admin']::text[])
    AND admin_role IS NULL
    AND invited_by IS NULL
    AND invited_at IS NULL
  );

COMMIT;
