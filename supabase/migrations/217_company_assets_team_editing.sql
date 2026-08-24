-- Same team-editing gap on the company asset tables: photos and social
-- links were owner_id-only. Team policies via is_company_editor (216).
CREATE POLICY company_photos_team_write ON public.company_photos
FOR ALL TO authenticated
USING (public.is_company_editor(company_id))
WITH CHECK (public.is_company_editor(company_id));

CREATE POLICY company_social_links_team_write ON public.company_social_links
FOR ALL TO authenticated
USING (public.is_company_editor(company_id))
WITH CHECK (public.is_company_editor(company_id));
