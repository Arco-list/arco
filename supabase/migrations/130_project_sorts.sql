-- ═══════════════════════════════════════════════════════════════════════
-- 130: Project discover sorts
-- ═══════════════════════════════════════════════════════════════════════
-- Adds the signals needed for the new sort options on /projects:
--   • credited_count — # of actively credited professionals on a project,
--     for "Most relevant" and as the "Featured" tiebreaker
--   • increment_project_views RPC — drives the Popular sort by bumping
--     projects.views_count on each project-detail render
--
-- The existing project_search_documents view wraps mv_project_summary and
-- is the source for the discover grid. We extend it with credited_count
-- via a correlated subquery rather than touching mv_project_summary —
-- keeps the surface area of this migration small and leaves the rest of
-- that view's consumers untouched.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.project_search_documents AS
SELECT
  p.*,
  (
    SELECT count(*)::integer
    FROM public.project_professionals pp
    WHERE pp.project_id = p.id
      AND pp.status IN ('live_on_page', 'listed')
  ) AS credited_count
FROM (
  SELECT
    id,
    title,
    description,
    translations,
    location,
    project_type,
    building_type,
    project_size,
    style_preferences,
    features,
    budget_level,
    budget_min,
    budget_max,
    is_featured,
    likes_count,
    views_count,
    status,
    slug,
    project_year,
    building_year,
    client_first_name,
    client_last_name,
    client_avatar,
    primary_photo_url,
    primary_photo_alt,
    primary_category,
    primary_category_slug,
    primary_category_icon,
    primary_category_color,
    photo_count,
    budget_display,
    created_at,
    updated_at,
    to_tsvector('simple', TRIM(BOTH ' ' FROM (
      COALESCE(title, '') || ' ' ||
      COALESCE(slug, '') || ' ' ||
      COALESCE(description, '') || ' ' ||
      COALESCE(location, '') || ' ' ||
      COALESCE(primary_category, '') || ' ' ||
      COALESCE(primary_category_slug, '') || ' ' ||
      COALESCE(project_type, '') || ' ' ||
      COALESCE(project_size, '') || ' ' ||
      COALESCE(building_type, '') || ' ' ||
      COALESCE(budget_display, '') || ' ' ||
      COALESCE(budget_level::text, '') || ' ' ||
      COALESCE(array_to_string(COALESCE(style_preferences, ARRAY[]::text[]), ' '), '') || ' ' ||
      COALESCE(array_to_string(COALESCE(features, ARRAY[]::text[]), ' '), '')
    ))) AS search_vector
  FROM public.mv_project_summary
) p;

COMMENT ON VIEW public.project_search_documents IS
  'Discover-grid source. Extends mv_project_summary with a full-text search_vector and a credited_count (active project_professionals rows) used for the Most-relevant and Featured sorts.';

-- ─── Popular sort signal ────────────────────────────────────────────────
-- RPC incremented on each project-detail page render. SECURITY DEFINER
-- so anonymous browsers can bump the counter without a table-level
-- UPDATE policy on projects. Guarded by the published-status check.

CREATE OR REPLACE FUNCTION public.increment_project_views(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.projects
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = p_project_id
    AND status = 'published';
END;
$$;

REVOKE ALL ON FUNCTION public.increment_project_views(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_project_views(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.increment_project_views(uuid) IS
  'Atomically bumps projects.views_count for the Popular sort on /projects. Called once per detail-page render. Safe for anon (SECURITY DEFINER + published-status guard).';
