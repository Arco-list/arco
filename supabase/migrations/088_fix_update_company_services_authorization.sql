-- Migration: Fix authorization vulnerability in update_company_services function
-- Issue: SECURITY DEFINER function lacked ownership verification
-- Severity: HIGH - Any authenticated user could update any company's data
-- Fix: Add ownership check before allowing updates

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
DECLARE
  v_user_id UUID;
  v_owner_id UUID;
BEGIN
  -- Get the current authenticated user's ID
  v_user_id := auth.uid();

  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get the company's owner_id
  SELECT owner_id INTO v_owner_id
  FROM public.companies
  WHERE id = p_company_id;

  -- Check if company exists
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  -- Verify the user owns this company
  IF v_owner_id != v_user_id THEN
    RAISE EXCEPTION 'Access denied: You do not own this company';
  END IF;

  -- Proceed with update (only reaches here if authorized)
  UPDATE public.companies
  SET
    primary_service_id = p_primary_service_id,
    services_offered = p_services_offered,
    languages = p_languages,
    certificates = p_certificates,
    updated_at = NOW()
  WHERE id = p_company_id;

  -- Refresh materialized views (non-concurrent to ensure atomicity)
  REFRESH MATERIALIZED VIEW public.mv_company_listings;

  -- If either operation fails, the transaction will roll back
  -- ensuring no partial updates occur
END;
$$;

-- Grant execute permission remains the same
GRANT EXECUTE ON FUNCTION public.update_company_services(UUID, UUID, TEXT[], TEXT[], TEXT[]) TO authenticated;

-- Update comment to reflect security fix
COMMENT ON FUNCTION public.update_company_services IS 'Atomically updates company services and refreshes materialized views with ownership verification. Only the company owner can update their company data. Ensures data consistency by rolling back all changes if view refresh fails.';
