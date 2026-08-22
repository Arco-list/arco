-- Expose address_city / address_region on the search view so region and
-- city filters can match structured fields instead of only ILIKE'ing the
-- free-text location label. Six published projects have a region but no
-- city (privacy-vague locations like "'t Gooi") — they were invisible to
-- the province filter, which expanded to member-city terms only.
-- Appended after scope_rotation so CREATE OR REPLACE keeps column order.
CREATE OR REPLACE VIEW public.project_search_documents AS
SELECT doc.*,
  (ROW_NUMBER() OVER (
    PARTITION BY doc.is_featured, COALESCE(doc.project_type, 'other')
    ORDER BY doc.credited_count DESC, COALESCE(doc.views_count, 0) DESC, doc.created_at DESC
  ))::int AS scope_rotation,
  pr.address_city,
  pr.address_region
FROM (
  SELECT id,
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
    search_vector,
    ( SELECT count(*)::integer AS count
           FROM project_professionals pp
          WHERE pp.project_id = p.id AND (pp.status = ANY (ARRAY['live_on_page'::professional_project_status, 'listed'::professional_project_status]))) AS credited_count
   FROM ( SELECT mv.id,
            mv.title,
            mv.description,
            mv.translations,
            mv.location,
            mv.project_type,
            mv.building_type,
            mv.project_size,
            mv.style_preferences,
            mv.features,
            mv.budget_level,
            mv.budget_min,
            mv.budget_max,
            mv.is_featured,
            mv.likes_count,
            mv.views_count,
            mv.status,
            mv.slug,
            mv.project_year,
            mv.building_year,
            mv.client_first_name,
            mv.client_last_name,
            mv.client_avatar,
            mv.primary_photo_url,
            mv.primary_photo_alt,
            mv.primary_category,
            mv.primary_category_slug,
            mv.primary_category_icon,
            mv.primary_category_color,
            mv.photo_count,
            mv.budget_display,
            mv.created_at,
            mv.updated_at,
            to_tsvector('simple'::regconfig, TRIM(BOTH ' '::text FROM (((((((((((((((((((((((COALESCE(mv.title, ''::text) || ' '::text) || COALESCE(mv.slug, ''::text)) || ' '::text) || COALESCE(mv.description, ''::text)) || ' '::text) || COALESCE(mv.location, ''::text)) || ' '::text) || COALESCE(mv.primary_category, ''::text)) || ' '::text) || COALESCE(mv.primary_category_slug, ''::text)) || ' '::text) || COALESCE(mv.project_type, ''::text)) || ' '::text) || COALESCE(mv.project_size, ''::text)) || ' '::text) || COALESCE(mv.building_type, ''::text)) || ' '::text) || COALESCE(mv.budget_display, ''::text)) || ' '::text) || COALESCE(mv.budget_level::text, ''::text)) || ' '::text) || COALESCE(array_to_string(COALESCE(mv.style_preferences, ARRAY[]::text[]), ' '::text), ''::text)) || ' '::text) || COALESCE(array_to_string(COALESCE(mv.features, ARRAY[]::text[]), ' '::text), ''::text))) AS search_vector
           FROM mv_project_summary mv) p
) doc
LEFT JOIN public.projects pr ON pr.id = doc.id;
