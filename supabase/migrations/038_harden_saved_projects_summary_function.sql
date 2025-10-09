-- Description: Harden saved projects summary function by scoping to auth user
set check_function_bodies = off;
set search_path = public;

drop function if exists public.get_user_saved_projects_with_summary(uuid);

create or replace function public.get_user_saved_projects_with_summary()
returns table (
  saved_at timestamptz,
  id uuid,
  slug text,
  title text,
  primary_photo_url text,
  primary_photo_alt text,
  location text,
  likes_count integer,
  created_at timestamptz,
  updated_at timestamptz,
  budget_display text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    sp.created_at as saved_at,
    mv.id,
    mv.slug,
    mv.title,
    mv.primary_photo_url,
    mv.primary_photo_alt,
    mv.location,
    mv.likes_count,
    mv.created_at,
    mv.updated_at,
    mv.budget_display
  from public.saved_projects sp
  inner join public.mv_project_summary mv
    on sp.project_id = mv.id
  where sp.user_id = v_user_id
  order by sp.created_at desc;
end;
$function$;

grant execute on function public.get_user_saved_projects_with_summary() to authenticated;

comment on function public.get_user_saved_projects_with_summary() is
  'Fetches saved projects for the authenticated user with summary data using a single query.';
