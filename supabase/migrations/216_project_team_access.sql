-- Team access to company-owned projects. Editing rights previously keyed
-- ONLY on projects.client_id (the account that created/imported the row)
-- — company owners and team members of the OWNING company (linked via
-- project_professionals.is_project_owner) could not read drafts or write
-- at all.
--
-- The predicate lives in a SECURITY DEFINER function: inlining the
-- EXISTS against project_professionals recursed (pp's own RLS references
-- projects) and every authenticated projects query failed with
-- "infinite recursion detected in policy". SECURITY DEFINER runs as
-- owner, so the inner lookups bypass RLS and break the cycle.
-- Depends on is_company_editor (migration 216).

CREATE OR REPLACE FUNCTION public.is_project_team_editor(p_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_professionals pp
    WHERE pp.project_id = p_project_id AND pp.is_project_owner = true
      AND public.is_company_editor(pp.company_id)
  );
$$;

CREATE POLICY projects_team_read ON public.projects
FOR SELECT TO authenticated
USING (public.is_project_team_editor(id));

CREATE POLICY projects_team_update ON public.projects
FOR UPDATE TO authenticated
USING (public.is_project_team_editor(id));
