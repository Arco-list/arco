-- Fix search_projects function - change feature_filters from uuid[] to text[] to match column type

-- Drop the old function with incorrect parameter type
DROP FUNCTION IF EXISTS public.search_projects(text, text, uuid, project_budget_level, text, text[], uuid[], boolean, integer, integer);

-- Create the corrected function
CREATE OR REPLACE FUNCTION public.search_projects(
  search_query text DEFAULT NULL::text,
  location_filter text DEFAULT NULL::text,
  category_filter uuid DEFAULT NULL::uuid,
  budget_filter project_budget_level DEFAULT NULL::project_budget_level,
  project_type_filter text DEFAULT NULL::text,
  style_filters text[] DEFAULT NULL::text[],
  feature_filters text[] DEFAULT NULL::text[],  -- Changed from uuid[] to text[]
  featured_only boolean DEFAULT false,
  limit_count integer DEFAULT 20,
  offset_count integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  title text,
  location text,
  project_type text,
  primary_photo_url text,
  primary_category text,
  budget_display text,
  likes_count integer,
  is_featured boolean,
  slug text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.location,
    p.project_type,
    p.primary_photo_url,
    p.primary_category,
    p.budget_display,
    p.likes_count,
    p.is_featured,
    p.slug,
    p.created_at
  FROM public.mv_project_summary p
  WHERE
    (NOT featured_only OR p.is_featured = TRUE)
    AND (location_filter IS NULL OR p.location ILIKE '%' || location_filter || '%')
    AND (budget_filter IS NULL OR p.budget_level = budget_filter)
    AND (project_type_filter IS NULL OR p.project_type ILIKE '%' || project_type_filter || '%')
    AND (category_filter IS NULL OR p.id IN (
      SELECT pc.project_id
      FROM public.project_categories pc
      WHERE pc.category_id = category_filter
    ))
    AND (style_filters IS NULL OR p.style_preferences && style_filters)
    AND (feature_filters IS NULL OR p.features && feature_filters)
    AND (search_query IS NULL OR (
      p.title ILIKE '%' || search_query || '%'
      OR p.description ILIKE '%' || search_query || '%'
      OR p.location ILIKE '%' || search_query || '%'
    ))
  ORDER BY
    p.is_featured DESC,
    p.likes_count DESC,
    p.created_at DESC
  LIMIT limit_count OFFSET offset_count;
END;
$function$;
