-- Migration: Fix triggers to use company_ratings instead of professional_ratings
-- Description: Update triggers to work with company-based ratings

-- Drop old trigger (if exists) on company_ratings
DROP TRIGGER IF EXISTS refresh_mv_on_rating_change ON public.company_ratings;

-- Create new trigger on company_ratings table
CREATE TRIGGER refresh_mv_on_rating_change
  AFTER INSERT OR UPDATE OR DELETE ON public.company_ratings
  FOR EACH ROW EXECUTE FUNCTION public.trigger_mv_refresh();

-- Fix the refresh function to not use CONCURRENT on mv_project_summary
-- (CONCURRENT requires a unique index which mv_project_summary doesn't have)
CREATE OR REPLACE FUNCTION public.refresh_all_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_company_listings;
  REFRESH MATERIALIZED VIEW public.mv_project_summary;
END;
$$;

COMMENT ON FUNCTION public.refresh_all_materialized_views IS 'Refresh all materialized views for updated data (companies use CONCURRENT, projects use regular refresh)';
