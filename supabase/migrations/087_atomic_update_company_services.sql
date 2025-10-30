-- Migration: Create atomic function for updating company services
-- Description: Ensures company services updates and materialized view refreshes happen atomically
-- Fixes data consistency issue where view refresh failure could leave stale data

-- Create atomic function to update company services and refresh views
CREATE OR REPLACE FUNCTION public.update_company_services(
  p_company_id UUID,
  p_primary_service_id UUID,
  p_services_offered TEXT[],
  p_languages TEXT[],
  p_certificates TEXT[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update company services in a transaction
  UPDATE public.companies
  SET
    primary_service_id = p_primary_service_id,
    services_offered = p_services_offered,
    languages = p_languages,
    certificates = p_certificates,
    updated_at = NOW()
  WHERE id = p_company_id;

  -- Refresh materialized views (non-concurrent to ensure atomicity)
  -- This will briefly lock the views but ensures data consistency
  REFRESH MATERIALIZED VIEW public.mv_company_listings;

  -- If either operation fails, the transaction will roll back
  -- ensuring no partial updates occur
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_company_services(UUID, UUID, TEXT[], TEXT[], TEXT[]) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.update_company_services IS 'Atomically updates company services and refreshes materialized views. Ensures data consistency by rolling back all changes if view refresh fails.';
