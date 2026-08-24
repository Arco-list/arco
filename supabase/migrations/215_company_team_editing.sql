-- Team members can edit their company. Editing was keyed on owner_id
-- everywhere (companies UPDATE policy, hero-photo RPCs), so members and
-- admins invited via /dashboard/team hit "Not authorized" on any company
-- edit. One shared SECURITY DEFINER check covers all three membership
-- forms; used by the RLS policy and both RPCs.

CREATE OR REPLACE FUNCTION public.is_company_editor(p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies co
    WHERE co.id = p_company_id AND co.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.company_contacts cc
    JOIN public.persons pe ON pe.id = cc.person_id
    WHERE cc.company_id = p_company_id
      AND cc.status = 'active' AND cc.role IN ('owner','admin','member')
      AND pe.auth_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.professionals pr
    WHERE pr.company_id = p_company_id AND pr.user_id = auth.uid()
  );
$$;

CREATE POLICY companies_team_update ON public.companies
FOR UPDATE TO authenticated
USING (public.is_company_editor(id));

CREATE OR REPLACE FUNCTION public.set_company_hero_photo(
  p_company_id uuid, p_project_id uuid, p_photo_url text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_company_editor(p_company_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_professionals
    WHERE company_id = p_company_id AND project_id = p_project_id
  ) THEN
    RAISE EXCEPTION 'Project not linked to company';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_photos
    WHERE project_id = p_project_id AND url = p_photo_url
  ) THEN
    RAISE EXCEPTION 'Photo not found in project';
  END IF;

  UPDATE public.companies
  SET hero_photo_url = p_photo_url,
      hero_photo_project_id = p_project_id
  WHERE id = p_company_id;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_professional_summary;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_company_hero_photo(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_company_editor(p_company_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.companies
  SET hero_photo_url = NULL,
      hero_photo_project_id = NULL
  WHERE id = p_company_id;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_professional_summary;
END;
$$;
