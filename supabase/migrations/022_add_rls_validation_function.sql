-- Migration 022: Add RLS Validation Helper Function
-- Purpose: Provide runtime RLS validation utilities for security monitoring
-- Created: 2025-10-01

-- Function to check if RLS is enabled on a table
CREATE OR REPLACE FUNCTION public.check_rls_enabled(table_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  -- Query pg_tables to check RLS status
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = table_name
    AND relnamespace = 'public'::regnamespace;

  -- Return false if table not found
  RETURN COALESCE(rls_enabled, FALSE);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_rls_enabled(TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.check_rls_enabled(TEXT) IS
  'Security utility: Checks if Row Level Security is enabled on a table. ' ||
  'Used for runtime RLS validation and security monitoring.';

-- Verify RLS is enabled on critical tables
DO $$
DECLARE
  critical_tables TEXT[] := ARRAY[
    'profiles',
    'projects',
    'project_photos',
    'project_features',
    'companies',
    'professionals',
    'project_applications',
    'reviews',
    'messages',
    'saved_projects',
    'saved_professionals',
    'notifications'
  ];
  table_name TEXT;
  rls_status BOOLEAN;
BEGIN
  FOREACH table_name IN ARRAY critical_tables
  LOOP
    SELECT relrowsecurity INTO rls_status
    FROM pg_class
    WHERE relname = table_name
      AND relnamespace = 'public'::regnamespace;

    IF NOT COALESCE(rls_status, FALSE) THEN
      RAISE WARNING 'RLS is NOT enabled on table: %', table_name;
    ELSE
      RAISE NOTICE 'RLS is enabled on table: %', table_name;
    END IF;
  END LOOP;
END;
$$;
