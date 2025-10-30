-- Migration: Fix get_user_saved_companies_with_summary to return cover photo
-- Description: Update function to return actual cover photo instead of logo

DROP FUNCTION IF EXISTS public.get_user_saved_companies_with_summary();

CREATE OR REPLACE FUNCTION public.get_user_saved_companies_with_summary()
RETURNS TABLE (
  -- Saved company metadata
  saved_at timestamptz,

  -- Company summary columns (from mv_company_listings)
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
  display_rating numeric,
  total_reviews integer,
  is_verified boolean,
  cover_url text,
  logo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sc.created_at as saved_at,
    c.id as professional_id,
    c.id as company_id,
    c.name as company_name,
    c.slug as company_slug,
    c.logo_url as company_logo,
    c.domain as company_domain,
    c.city as company_city,
    c.country as company_country,
    c.state_region as company_state_region,
    c.professional_title as title,
    c.first_name,
    c.last_name,
    c.primary_service as primary_specialty,
    c.primary_service_name,
    c.services_offered,
    c.user_location,
    c.display_rating,
    c.total_reviews,
    c.is_verified,
    c.cover_photo_url as cover_url,
    c.logo_url as logo_url
  FROM saved_companies sc
  INNER JOIN mv_company_listings c ON sc.company_id = c.id
  WHERE sc.user_id = auth.uid()
  ORDER BY sc.created_at DESC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_saved_companies_with_summary() TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.get_user_saved_companies_with_summary() IS
  'Fetches saved companies for a user with full company listing data including cover photos';
