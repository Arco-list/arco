-- Supabase linter fixes.
--
-- Two categories:
--
--   1. Two views (company_metrics, project_search_documents) run
--      SECURITY DEFINER by default — so RLS on the underlying tables
--      is evaluated as the view's owner, bypassing the caller's own
--      row-level filters. Recreate both with security_invoker=true so
--      the caller's role decides what they can see.
--
--   2. Four tables (kb_chunks, metric_cache, inbound_emails,
--      gmail_connections) are in the public schema and therefore
--      exposed via PostgREST, but RLS was never enabled. Every path
--      that reads or writes them today uses the service-role client
--      (verified across app/[locale]/admin/inbox/*.ts,
--      lib/growth-metric-cache.ts, app/api/admin/reindex-kb/route.ts).
--      Enabling RLS with no permissive policies preserves service-
--      role access (SUPERUSER bypasses RLS) and blocks anon /
--      authenticated PostgREST reads. gmail_connections in particular
--      carries OAuth access_token + refresh_token — cannot leak.
--
-- No behavior change expected for admin surfaces; if any legitimate
-- non-service-role read starts returning empty, add a scoped policy
-- for the specific role that needs it (e.g. `USING (auth.uid() = user_id)`).

-- ── 1. Security-invoker views ──────────────────────────────────────────

CREATE OR REPLACE VIEW public.company_metrics WITH (security_invoker=true) AS
  WITH professional_counts AS (
    SELECT professionals.company_id,
      count(*)::integer AS professional_count
    FROM public.professionals
    WHERE professionals.company_id IS NOT NULL
    GROUP BY professionals.company_id
  ), project_counts AS (
    SELECT p.company_id,
      count(DISTINCT pp.project_id)::integer AS projects_linked
    FROM public.professionals p
      JOIN public.project_professionals pp ON pp.professional_id = p.id
    WHERE p.company_id IS NOT NULL
    GROUP BY p.company_id
  )
  SELECT c.id AS company_id,
    COALESCE(pc.professional_count, 0) AS professional_count,
    COALESCE(prc.projects_linked, 0) AS projects_linked
  FROM public.companies c
    LEFT JOIN professional_counts pc ON pc.company_id = c.id
    LEFT JOIN project_counts prc ON prc.company_id = c.id;

CREATE OR REPLACE VIEW public.project_search_documents WITH (security_invoker=true) AS
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
    ( SELECT count(*)::integer
        FROM public.project_professionals pp
        WHERE pp.project_id = p.id
          AND pp.status = ANY (ARRAY['live_on_page'::professional_project_status, 'listed'::professional_project_status])
    ) AS credited_count
  FROM (
    SELECT
      mv.id, mv.title, mv.description, mv.translations, mv.location,
      mv.project_type, mv.building_type, mv.project_size,
      mv.style_preferences, mv.features, mv.budget_level, mv.budget_min,
      mv.budget_max, mv.is_featured, mv.likes_count, mv.views_count,
      mv.status, mv.slug, mv.project_year, mv.building_year,
      mv.client_first_name, mv.client_last_name, mv.client_avatar,
      mv.primary_photo_url, mv.primary_photo_alt, mv.primary_category,
      mv.primary_category_slug, mv.primary_category_icon,
      mv.primary_category_color, mv.photo_count, mv.budget_display,
      mv.created_at, mv.updated_at,
      to_tsvector('simple'::regconfig, TRIM(BOTH ' ' FROM (
        COALESCE(mv.title, '') || ' ' ||
        COALESCE(mv.slug, '') || ' ' ||
        COALESCE(mv.description, '') || ' ' ||
        COALESCE(mv.location, '') || ' ' ||
        COALESCE(mv.primary_category, '') || ' ' ||
        COALESCE(mv.primary_category_slug, '') || ' ' ||
        COALESCE(mv.project_type, '') || ' ' ||
        COALESCE(mv.project_size, '') || ' ' ||
        COALESCE(mv.building_type, '') || ' ' ||
        COALESCE(mv.budget_display, '') || ' ' ||
        COALESCE(mv.budget_level::text, '') || ' ' ||
        COALESCE(array_to_string(COALESCE(mv.style_preferences, ARRAY[]::text[]), ' '), '') || ' ' ||
        COALESCE(array_to_string(COALESCE(mv.features, ARRAY[]::text[]), ' '), '')
      ))) AS search_vector
    FROM public.mv_project_summary mv
  ) p;

-- ── 2. Enable RLS on server-only tables ────────────────────────────────

ALTER TABLE public.kb_chunks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_cache      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_emails    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.gmail_connections IS
  'OAuth tokens for the Gmail inbox sync. Server-role only — RLS is enabled with no permissive policies so PostgREST anon / authenticated cannot read access_token or refresh_token.';
