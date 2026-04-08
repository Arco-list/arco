-- Extend get_user_saved_projects_with_summary to return projects.translations
-- so the saved-projects surface on the dashboard can render locale-aware
-- titles. Return type changed (new column), so the function must be dropped
-- and recreated rather than CREATE OR REPLACE'd.

drop function if exists public.get_user_saved_projects_with_summary();

create or replace function public.get_user_saved_projects_with_summary()
returns TABLE(
  saved_at timestamp with time zone,
  id uuid,
  slug text,
  title text,
  translations jsonb,
  primary_photo_url text,
  primary_photo_alt text,
  location text,
  likes_count integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  budget_display text,
  style_preferences text[],
  project_type text
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
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
    mv.translations,
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
$function$;
