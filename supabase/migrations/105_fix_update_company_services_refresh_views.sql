-- Fix update_company_services to refresh both materialized views
-- Previously only refreshed mv_company_listings, missing mv_professional_summary
-- which is used by the /professionals listing and search_professionals RPC.

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
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM public.companies
  WHERE id = p_company_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  IF v_owner_id != v_user_id THEN
    RAISE EXCEPTION 'Access denied: You do not own this company';
  END IF;

  UPDATE public.companies
  SET
    primary_service_id = p_primary_service_id,
    services_offered = p_services_offered,
    languages = p_languages,
    certificates = p_certificates,
    updated_at = NOW()
  WHERE id = p_company_id;

  REFRESH MATERIALIZED VIEW public.mv_company_listings;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_professional_summary;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_company_services(UUID, UUID, TEXT[], TEXT[], TEXT[]) TO authenticated;
