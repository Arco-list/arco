-- Admin editing a non-owned company goes through getCompanyContext's
-- service-role client, where auth.uid() is NULL — so the hero RPC's
-- is_company_editor guard raised "Not authorized" for admins even after
-- 219 added the admin clause. Service-role requests come only from our
-- own server actions (the key never ships to browsers), so trust them:
-- RLS is bypassed for that role anyway; this guard runs inside RPCs.
CREATE OR REPLACE FUNCTION public.is_company_editor(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.role() = 'service_role'
  OR EXISTS (
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
