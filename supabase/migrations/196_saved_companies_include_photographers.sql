-- Extend get_user_saved_companies_with_summary to surface saved
-- photographers under the shared Saved Professionals list.
--
-- mv_professional_summary excludes audience='pro' rows by design
-- (photographers live on their own detail page and until now had no
-- browse surface). The RPC's INNER JOIN dropped them, so saving a
-- photographer from /businesses/photography wrote the saved_companies
-- row but the Saved list never displayed it.
--
-- Fix: UNION ALL a synthesized row per saved photographer, pulled
-- straight from companies. Fields the mv provides (first_name,
-- primary_specialty, services_offered, etc.) are NULL for these
-- rows because photographers are company-only. primary_service_name
-- is hardcoded to 'Photographer'.
--
-- NOT EXISTS guard on the photographer branch prevents double-return
-- for the (currently impossible, but future-proof) case where a
-- company would appear in both mv and the audience='pro' set.

CREATE OR REPLACE FUNCTION public.get_user_saved_companies_with_summary()
RETURNS TABLE (
  saved_at timestamp with time zone,
  professional_id uuid,
  company_id uuid,
  company_name text,
  company_slug text,
  company_logo text,
  company_domain text,
  company_city text,
  company_country text,
  company_state_region text,
  title text,
  first_name text,
  last_name text,
  primary_specialty text,
  primary_service_name text,
  services_offered text[],
  user_location text,
  is_verified boolean,
  cover_url text,
  logo_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sc.created_at AS saved_at,
    p.id          AS professional_id,
    p.company_id, p.company_name, p.company_slug, p.company_logo, p.company_domain,
    p.company_city, p.company_country, p.company_state_region,
    NULL::text    AS title,
    p.first_name, p.last_name,
    p.primary_specialty, p.primary_service_name, p.services_offered,
    NULL::text    AS user_location,
    p.is_verified,
    p.cover_photo_url AS cover_url,
    p.company_logo    AS logo_url
  FROM public.saved_companies sc
  JOIN public.mv_professional_summary p ON p.id = sc.company_id
  WHERE sc.user_id = auth.uid()

  UNION ALL

  SELECT
    sc.created_at    AS saved_at,
    c.id             AS professional_id,
    c.id             AS company_id,
    c.name           AS company_name,
    c.slug           AS company_slug,
    c.logo_url       AS company_logo,
    c.domain         AS company_domain,
    c.city           AS company_city,
    c.country        AS company_country,
    c.state_region   AS company_state_region,
    NULL::text       AS title,
    NULL::text       AS first_name,
    NULL::text       AS last_name,
    NULL::text       AS primary_specialty,
    'Photographer'::text AS primary_service_name,
    NULL::text[]     AS services_offered,
    NULL::text       AS user_location,
    false            AS is_verified,
    c.hero_photo_url AS cover_url,
    c.logo_url       AS logo_url
  FROM public.saved_companies sc
  JOIN public.companies c ON c.id = sc.company_id
  WHERE sc.user_id = auth.uid()
    AND c.audience = 'pro'
    AND NOT EXISTS (
      SELECT 1 FROM public.mv_professional_summary p WHERE p.id = sc.company_id
    )

  ORDER BY saved_at DESC;
$$;
