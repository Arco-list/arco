-- Description: allow authenticated users to update projects via toggle like function
set search_path = public;

create policy "projects_like_count_update" on public.projects
  for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
