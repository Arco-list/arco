-- Migration: Add taxonomy fields to get_user_saved_projects_with_summary
-- Description: Add style_preferences and project_type to construct consistent titles

DROP FUNCTION IF EXISTS public.get_user_saved_projects_with_summary();

CREATE OR REPLACE FUNCTION public.get_user_saved_projects_with_summary()
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
  budget_display text,
  -- ADDED: Fields needed to construct display title
  style_preferences text[],
  project_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
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
    mv.budget_display,
    mv.style_preferences,
    mv.project_type
  FROM public.saved_projects sp
  INNER JOIN public.mv_project_summary mv ON sp.project_id = mv.id
  WHERE sp.user_id = v_user_id
  ORDER BY sp.created_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_saved_projects_with_summary() TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.get_user_saved_projects_with_summary() IS
  'Fetches saved projects for a user with full summary data including taxonomy fields for title construction';
