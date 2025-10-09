-- Description: fix ambiguous likes_count reference in toggle_project_like
set check_function_bodies = off;
set search_path = public;

create or replace function public.toggle_project_like(p_project_id uuid)
returns table (liked boolean, likes_count integer)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid;
  v_likes_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (
    select 1
    from public.project_likes
    where user_id = v_user_id
      and project_id = p_project_id
  ) then
    delete from public.project_likes
    where user_id = v_user_id
      and project_id = p_project_id;
    liked := false;
  else
    insert into public.project_likes (user_id, project_id)
    values (v_user_id, p_project_id);
    liked := true;
  end if;

  select coalesce(p.likes_count, 0)
    into v_likes_count
    from public.projects as p
    where p.id = p_project_id;

  likes_count := coalesce(v_likes_count, 0);

  return next;
end;
$function$;
