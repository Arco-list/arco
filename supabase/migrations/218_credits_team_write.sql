-- Team members can manage credits/invites on their company's projects.
-- project_professionals writes were keyed on projects.client_id (the
-- importing account) — a team member crediting a contributor created the
-- company row but the credit INSERT failed silently, orphaning companies
-- like "Dokter Interieurbouw B.V." (status invited, linked to nothing).
-- is_project_team_editor (216) is SECURITY DEFINER, so its internal
-- project_professionals lookup bypasses RLS — no policy recursion.

CREATE POLICY project_professionals_team_insert ON public.project_professionals
FOR INSERT TO authenticated
WITH CHECK (public.is_project_team_editor(project_id));

CREATE POLICY project_professionals_team_update ON public.project_professionals
FOR UPDATE TO authenticated
USING (public.is_project_team_editor(project_id));

CREATE POLICY project_professionals_team_delete ON public.project_professionals
FOR DELETE TO authenticated
USING (public.is_project_team_editor(project_id));
