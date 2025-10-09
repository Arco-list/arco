-- Migration: Create function to fetch saved projects with summary
-- Optimizes N+1 query pattern by joining saved_projects with mv_project_summary in a single query
-- Created: 2025-10-09

-- Drop function if exists
DROP FUNCTION IF EXISTS public.get_user_saved_projects_with_summary(uuid);

-- Create function to get saved projects with full summary data
CREATE OR REPLACE FUNCTION public.get_user_saved_projects_with_summary(p_user_id uuid)
RETURNS TABLE (
  -- Saved project metadata
  saved_at timestamptz,

  -- Project summary columns (matching mv_project_summary)
  id uuid,
  slug text,
  title text,
  primary_photo_url text,
  primary_photo_alt text,
  location text,
  likes_count integer,
  created_at timestamptz,
  updated_at timestamptz,
  budget_display text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sp.created_at as saved_at,
    mv.id,
    mv.slug,
    mv.title,
    mv.primary_photo_url,
    mv.primary_photo_alt,
    mv.location,
    mv.likes_count,
    mv.created_at,
    mv.updated_at,
    mv.budget_display
  FROM saved_projects sp
  INNER JOIN mv_project_summary mv ON sp.project_id = mv.id
  WHERE sp.user_id = p_user_id
  ORDER BY sp.created_at DESC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_saved_projects_with_summary(uuid) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.get_user_saved_projects_with_summary(uuid) IS
  'Fetches saved projects for a user with full summary data in a single query, optimizing the N+1 pattern';
