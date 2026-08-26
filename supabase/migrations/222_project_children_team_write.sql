-- Team members could update the projects row (216) but every child
-- table was still keyed to projects.client_id — so a member's edits to
-- photos, rooms/features, taxonomy and categories silently wrote zero
-- rows ("ik heb niet de juiste rechten om projecten te bewerken",
-- Eliza/Bongers, Aug 25). is_project_team_editor is SECURITY DEFINER —
-- no policy recursion.

CREATE POLICY project_photos_team_write ON public.project_photos
FOR ALL TO authenticated
USING (public.is_project_team_editor(project_id))
WITH CHECK (public.is_project_team_editor(project_id));

CREATE POLICY project_features_team_write ON public.project_features
FOR ALL TO authenticated
USING (public.is_project_team_editor(project_id))
WITH CHECK (public.is_project_team_editor(project_id));

CREATE POLICY project_taxonomy_selections_team_write ON public.project_taxonomy_selections
FOR ALL TO authenticated
USING (public.is_project_team_editor(project_id))
WITH CHECK (public.is_project_team_editor(project_id));

CREATE POLICY project_categories_team_write ON public.project_categories
FOR ALL TO authenticated
USING (public.is_project_team_editor(project_id))
WITH CHECK (public.is_project_team_editor(project_id));
