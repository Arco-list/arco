-- Expose projects.translations through mv_project_summary, project_search_documents,
-- and the search_projects RPC so locale-aware title/description can be rendered
-- from the fast discovery + homepage paths without a round-trip to the projects table.
--
-- CASCADE drops the dependent view and RPC; they are recreated below. The RPC
-- signature changes (added translations to the return type), so it must be
-- dropped + recreated rather than CREATE OR REPLACE'd.

drop function if exists public.search_projects(text, text, uuid, project_budget_level, text, text[], text[], boolean, integer, integer);
drop materialized view if exists public.mv_project_summary cascade;

create materialized view public.mv_project_summary as
 SELECT p.id,
    p.title,
    p.description,
    p.translations,
    p.location,
    p.project_type,
    p.building_type,
    p.project_size,
    p.style_preferences,
    p.features,
    p.budget_level,
    p.budget_min,
    p.budget_max,
    p.is_featured,
    p.likes_count,
    p.views_count,
    p.status,
    p.slug,
    p.project_year,
    p.building_year,
    prof.first_name AS client_first_name,
    prof.last_name AS client_last_name,
    prof.avatar_url AS client_avatar,
    pp.url AS primary_photo_url,
    pp.alt_text AS primary_photo_alt,
    cat.name AS primary_category,
    cat.slug AS primary_category_slug,
    cat.icon AS primary_category_icon,
    cat.color AS primary_category_color,
    COALESCE(photo_stats.photo_count, 0::bigint) AS photo_count,
        CASE
            WHEN p.budget_min IS NOT NULL AND p.budget_max IS NOT NULL THEN ((p.budget_min || ' - '::text) || p.budget_max) || ' EUR'::text
            WHEN p.budget_level IS NOT NULL THEN initcap(replace(p.budget_level::text, '_'::text, ' '::text))
            ELSE 'Budget not specified'::text
        END AS budget_display,
    p.created_at,
    p.updated_at
   FROM projects p
     JOIN profiles prof ON p.client_id = prof.id
     LEFT JOIN project_photos pp ON p.id = pp.project_id AND pp.is_primary = true
     LEFT JOIN project_categories pc ON p.id = pc.project_id AND pc.is_primary = true
     LEFT JOIN categories cat ON pc.category_id = cat.id
     LEFT JOIN ( SELECT project_photos.project_id, count(*) AS photo_count
           FROM project_photos
          GROUP BY project_photos.project_id) photo_stats ON p.id = photo_stats.project_id
  WHERE p.status = 'published'::project_status AND prof.is_active = true AND NOT (EXISTS ( SELECT 1
           FROM project_professionals owner_pp
             JOIN companies owner_c ON owner_c.id = owner_pp.company_id
          WHERE owner_pp.project_id = p.id AND owner_pp.is_project_owner = true AND owner_c.status = 'added'::company_status));

create unique index idx_mv_project_summary_id on public.mv_project_summary using btree (id);
create index idx_mv_project_summary_featured on public.mv_project_summary using btree (is_featured);
create index idx_mv_project_summary_created on public.mv_project_summary using btree (created_at);
create index idx_mv_project_summary_likes on public.mv_project_summary using btree (likes_count);
create index idx_mv_project_summary_category on public.mv_project_summary using btree (primary_category);
create index idx_mv_project_summary_location on public.mv_project_summary using btree (location);
create index idx_mv_project_summary_budget on public.mv_project_summary using btree (budget_level);
create index idx_mv_project_summary_type on public.mv_project_summary using btree (project_type);
create index idx_mv_project_summary_search on public.mv_project_summary using gin (to_tsvector('simple'::regconfig, ((((COALESCE(title, ''::text) || ' '::text) || COALESCE(description, ''::text)) || ' '::text) || COALESCE(location, ''::text))));

-- Recreate project_search_documents view with translations column
create view public.project_search_documents as
 SELECT id, title, description, translations, location, project_type, building_type,
    project_size, style_preferences, features, budget_level, budget_min, budget_max,
    is_featured, likes_count, views_count, status, slug, project_year, building_year,
    client_first_name, client_last_name, client_avatar, primary_photo_url, primary_photo_alt,
    primary_category, primary_category_slug, primary_category_icon, primary_category_color,
    photo_count, budget_display, created_at, updated_at,
    to_tsvector('simple'::regconfig, TRIM(BOTH ' '::text FROM (((((((((((((((((((((((COALESCE(title, ''::text) || ' '::text) || COALESCE(slug, ''::text)) || ' '::text) || COALESCE(description, ''::text)) || ' '::text) || COALESCE(location, ''::text)) || ' '::text) || COALESCE(primary_category, ''::text)) || ' '::text) || COALESCE(primary_category_slug, ''::text)) || ' '::text) || COALESCE(project_type, ''::text)) || ' '::text) || COALESCE(project_size, ''::text)) || ' '::text) || COALESCE(building_type, ''::text)) || ' '::text) || COALESCE(budget_display, ''::text)) || ' '::text) || COALESCE(budget_level::text, ''::text)) || ' '::text) || COALESCE(array_to_string(COALESCE(style_preferences, ARRAY[]::text[]), ' '::text), ''::text)) || ' '::text) || COALESCE(array_to_string(COALESCE(features, ARRAY[]::text[]), ' '::text), ''::text))) AS search_vector
   FROM mv_project_summary p;

-- Re-apply security_invoker (dropped by CASCADE, see migration 121)
alter view public.project_search_documents set (security_invoker = true);

-- Recreate search_projects RPC with translations in the return table
create or replace function public.search_projects(
  search_query text DEFAULT NULL::text,
  location_filter text DEFAULT NULL::text,
  category_filter uuid DEFAULT NULL::uuid,
  budget_filter project_budget_level DEFAULT NULL::project_budget_level,
  project_type_filter text DEFAULT NULL::text,
  style_filters text[] DEFAULT NULL::text[],
  feature_filters text[] DEFAULT NULL::text[],
  featured_only boolean DEFAULT false,
  limit_count integer DEFAULT 20,
  offset_count integer DEFAULT 0
)
returns TABLE(
  id uuid, title text, translations jsonb, location text, project_type text,
  primary_photo_url text, primary_category text, budget_display text,
  likes_count integer, is_featured boolean, slug text, created_at timestamp with time zone
)
language plpgsql
stable
set search_path to 'public'
as $function$
BEGIN
  RETURN QUERY
  SELECT p.id, p.title, p.translations, p.location, p.project_type, p.primary_photo_url,
    p.primary_category, p.budget_display, p.likes_count, p.is_featured, p.slug, p.created_at
  FROM public.mv_project_summary p
  WHERE (NOT featured_only OR p.is_featured = TRUE)
    AND (location_filter IS NULL OR p.location ILIKE '%' || location_filter || '%')
    AND (budget_filter IS NULL OR p.budget_level = budget_filter)
    AND (project_type_filter IS NULL OR p.project_type ILIKE '%' || project_type_filter || '%')
    AND (category_filter IS NULL OR p.id IN (SELECT pc.project_id FROM public.project_categories pc WHERE pc.category_id = category_filter))
    AND (style_filters IS NULL OR p.style_preferences && style_filters)
    AND (feature_filters IS NULL OR p.features && feature_filters)
    AND (search_query IS NULL OR (p.title ILIKE '%' || search_query || '%' OR p.description ILIKE '%' || search_query || '%' OR p.location ILIKE '%' || search_query || '%'))
  ORDER BY p.is_featured DESC, p.likes_count DESC, p.created_at DESC
  LIMIT limit_count OFFSET offset_count;
END;
$function$;

refresh materialized view public.mv_project_summary;
