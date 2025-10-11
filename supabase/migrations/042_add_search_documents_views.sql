-- Create views that expose search-ready documents for projects and professionals
DROP VIEW IF EXISTS public.project_search_documents;
CREATE VIEW public.project_search_documents AS
SELECT
  p.*,
  to_tsvector(
    'simple',
    trim(
      both ' '
      FROM (
        COALESCE(p.title, '') || ' ' ||
        COALESCE(p.slug, '') || ' ' ||
        COALESCE(p.description, '') || ' ' ||
        COALESCE(p.location, '') || ' ' ||
        COALESCE(p.primary_category, '') || ' ' ||
        COALESCE(p.primary_category_slug, '') || ' ' ||
        COALESCE(p.project_type, '') || ' ' ||
        COALESCE(p.project_size, '') || ' ' ||
        COALESCE(p.building_type, '') || ' ' ||
        COALESCE(p.budget_display, '') || ' ' ||
        COALESCE(p.budget_level::text, '') || ' ' ||
        COALESCE(array_to_string(COALESCE(p.style_preferences, ARRAY[]::text[]), ' '), '') || ' ' ||
        COALESCE(array_to_string(COALESCE(p.features, ARRAY[]::text[]), ' '), '')
      )
    )
  ) AS search_vector
FROM public.mv_project_summary p;

DROP VIEW IF EXISTS public.professional_search_documents;
CREATE VIEW public.professional_search_documents AS
SELECT
  p.*,
  to_tsvector(
    'simple',
    trim(
      both ' '
      FROM (
        COALESCE(p.company_name, '') || ' ' ||
        COALESCE(p.title, '') || ' ' ||
        COALESCE(p.bio, '') || ' ' ||
        COALESCE(p.user_location, '') || ' ' ||
        COALESCE(p.primary_specialty, '') || ' ' ||
        COALESCE(p.primary_specialty_slug, '') || ' ' ||
        COALESCE(p.first_name, '') || ' ' ||
        COALESCE(p.last_name, '') || ' ' ||
        COALESCE(array_to_string(COALESCE(p.services_offered, ARRAY[]::text[]), ' '), '') || ' ' ||
        COALESCE(array_to_string(COALESCE(p.languages_spoken, ARRAY[]::text[]), ' '), '')
      )
    )
  ) AS search_vector
FROM public.mv_professional_summary p;
