-- Description: remove overly permissive projects like count update policy
set search_path = public;

drop policy if exists "projects_like_count_update" on public.projects;
