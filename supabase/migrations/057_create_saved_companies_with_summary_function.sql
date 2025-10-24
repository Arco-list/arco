-- Migration: Create function to fetch saved companies with summary
-- Optimizes N+1 query pattern by joining saved_companies with mv_professional_summary in a single query
-- Created: 2025-10-24

-- Drop function if exists
DROP FUNCTION IF EXISTS public.get_user_saved_companies_with_summary();

-- Create function to get saved companies with full summary data
CREATE OR REPLACE FUNCTION public.get_user_saved_companies_with_summary()
RETURNS TABLE (
  -- Saved company metadata
  saved_at timestamptz,

  -- Company/Professional summary columns (from mv_professional_summary)
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
    mv.id as professional_id,
    mv.company_id,
    mv.company_name,
    mv.company_slug,
    mv.company_logo,
    mv.company_domain,
    mv.company_city,
    mv.company_country,
    mv.company_state_region,
    mv.title,
    mv.first_name,
    mv.last_name,
    mv.primary_specialty,
    mv.services_offered,
    mv.user_location,
    mv.display_rating,
    mv.total_reviews,
    mv.is_verified,
    mv.company_logo as cover_url,
    mv.company_logo as logo_url
  FROM saved_companies sc
  INNER JOIN mv_professional_summary mv ON sc.company_id = mv.company_id
  WHERE sc.user_id = auth.uid()
  ORDER BY sc.created_at DESC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_saved_companies_with_summary() TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.get_user_saved_companies_with_summary() IS
  'Fetches saved companies for a user with full professional summary data in a single query, optimizing the N+1 pattern';
