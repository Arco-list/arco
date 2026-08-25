-- Platform admins can edit any company. is_company_editor (215) covered
-- owner + active team contacts + professionals rows but not admins, so
-- an admin editing a company profile got "Not authorized" from the hero
-- RPCs (and every policy routed through this function). Admin flows
-- through here to project access and credits via is_project_team_editor.
CREATE OR REPLACE FUNCTION public.is_company_editor(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.user_types, '{}'::text[]) @> ARRAY['admin'::text]
  );
$function$;
