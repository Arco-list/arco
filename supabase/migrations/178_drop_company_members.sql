-- Drop the legacy company_members table.
--
-- All app readers have been switched to company_contacts (filtered to
-- team roles owner/admin/member); the dual-write from the team page is
-- removed. Two DB-side dependents need updating before the drop:
--   - is_active_company_member() — SECURITY DEFINER helper used by the
--     legacy company_members.policy_member_read; rewritten to read from
--     company_contacts.
--   - update_company_services() — its access-control SELECT joined
--     company_members; rewritten to join company_contacts.

CREATE OR REPLACE FUNCTION public.is_active_company_member(_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM company_contacts cc
    JOIN persons p ON p.id = cc.person_id
    WHERE cc.company_id = _company_id
      AND p.auth_user_id = auth.uid()
      AND cc.role IN ('owner', 'admin', 'member')
      AND cc.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_company_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_active_company_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_company_services(
  p_company_id uuid,
  p_primary_service_id uuid,
  p_services_offered text[],
  p_languages text[],
  p_certificates text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_has_access boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_id = v_user_id
    UNION ALL
    SELECT 1 FROM public.company_contacts cc
      JOIN public.persons p ON p.id = cc.person_id
      WHERE cc.company_id = p_company_id
        AND p.auth_user_id = v_user_id
        AND cc.role IN ('owner', 'admin', 'member')
        AND cc.status = 'active'
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Access denied: You do not have access to this company';
  END IF;

  UPDATE public.companies
  SET primary_service_id = p_primary_service_id,
      services_offered = p_services_offered,
      languages = p_languages,
      certificates = p_certificates,
      updated_at = NOW()
  WHERE id = p_company_id;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_professional_summary;
END;
$$;

DROP TABLE IF EXISTS public.company_members CASCADE;
