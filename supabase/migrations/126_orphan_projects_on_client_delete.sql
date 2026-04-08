-- Allow projects to be orphaned (client_id = NULL) when their owning client
-- account is deleted, instead of cascading the delete and wiping the project.
-- This lets the self-delete flow keep the project intact under the company
-- that credited it, so other credited professionals don't lose their work.
--
-- Pairs with the self-delete flow change in app/[locale]/homeowner/actions.ts:
-- companies are orphaned (owner_id = null, status = 'unlisted') instead of
-- deleted, and projects are archived so they stop appearing in discover while
-- remaining intact under the company that credited them.

alter table public.projects
  alter column client_id drop not null;

alter table public.projects
  drop constraint if exists projects_client_id_fkey;

alter table public.projects
  add constraint projects_client_id_fkey
    foreign key (client_id)
    references public.profiles(id)
    on delete set null;
