-- Storage uploads to project-photos were the last owner-keyed layer:
-- is_project_photo_owner_by_path only accepted projects.client_id, so a
-- team member's photo upload was refused even after 222 opened the
-- project_photos table. Widen the path check to the same team rule.
CREATE OR REPLACE FUNCTION public.is_project_photo_owner_by_path(_path text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = split_part(_path, '/', 1)::uuid
      AND p.client_id = auth.uid()
  )
  OR public.is_project_team_editor(split_part(_path, '/', 1)::uuid);
$function$;
