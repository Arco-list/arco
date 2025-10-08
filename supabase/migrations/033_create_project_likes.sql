-- Description: add project_likes table, policies, triggers, and toggle function
set check_function_bodies = off;
set search_path = public;

-- Create project_likes table
create table public.project_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, project_id)
);

comment on table public.project_likes is 'Individual project likes from users';

-- Indexes for performance
create index idx_project_likes_project_id on public.project_likes(project_id);
create index idx_project_likes_created_at on public.project_likes(project_id, created_at desc);

-- Enable RLS
alter table public.project_likes enable row level security;

-- Policies
create policy "project_likes_own_read" on public.project_likes
  for select using (auth.uid() = user_id);

create policy "project_likes_own_write" on public.project_likes
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger function to keep projects.likes_count in sync
create or replace function public.update_project_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.projects
      set likes_count = coalesce(likes_count, 0) + 1,
          updated_at = now()
      where id = new.project_id;
  elsif tg_op = 'DELETE' then
    update public.projects
      set likes_count = greatest(coalesce(likes_count, 0) - 1, 0),
          updated_at = now()
      where id = old.project_id;
  end if;

  return null;
end;
$$;

create trigger project_likes_after_insert
  after insert on public.project_likes
  for each row
  execute function public.update_project_likes_count();

create trigger project_likes_after_delete
  after delete on public.project_likes
  for each row
  execute function public.update_project_likes_count();

-- RPC to toggle project like and return latest state/count
create or replace function public.toggle_project_like(p_project_id uuid)
returns table (liked boolean, likes_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_likes_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (
    select 1 from public.project_likes
    where user_id = v_user_id and project_id = p_project_id
  ) then
    delete from public.project_likes
    where user_id = v_user_id and project_id = p_project_id;
    liked := false;
  else
    insert into public.project_likes (user_id, project_id)
    values (v_user_id, p_project_id);
    liked := true;
  end if;

  select coalesce(likes_count, 0)
    into v_likes_count
    from public.projects
    where id = p_project_id;

  likes_count := coalesce(v_likes_count, 0);

  return next;
end;
$$;

grant execute on function public.toggle_project_like to anon, authenticated;
