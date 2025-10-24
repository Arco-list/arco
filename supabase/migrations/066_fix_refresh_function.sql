-- Migration: Fix refresh_all_materialized_views to use mv_company_listings
-- Description: Update refresh function to use new company-based view

-- Recreate the refresh function to use mv_company_listings
CREATE OR REPLACE FUNCTION public.refresh_all_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_company_listings;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_project_summary;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_all_materialized_views() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_all_materialized_views() TO anon;

COMMENT ON FUNCTION public.refresh_all_materialized_views IS 'Refresh all materialized views for updated data';
