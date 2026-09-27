-- Editable copy for the hand-written outbound mails.
--
-- The situations themselves stay in code (lib/outbound/templates.ts):
-- which states exist, which link each one carries, and what the CTA
-- says are decisions about how the funnel works, and a wrong value
-- there sends a claim link to somebody who already owns their page.
-- What lives HERE is only the wording — the subject and the mail — so
-- it can be edited on /emails without a deploy.
--
-- A row is an OVERRIDE, not a definition. No row means the code's
-- default is used, so the table starts empty and deleting a row is a
-- safe way back to the shipped copy.
create table if not exists public.outbound_templates (
  -- One row per situation id. Text rather than an enum: the set lives
  -- in TypeScript, and an enum here would be a second place to change
  -- every time a situation is added.
  situation_id text primary key,
  subject      text not null,
  body         text not null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id) on delete set null
);

comment on table public.outbound_templates is
  'Admin-edited subject/body for outbound situations. Absent row = use the default in lib/outbound/templates.ts.';
comment on column public.outbound_templates.body is
  'Plain text. May contain {{voornaam}} and {{bedrijf}}, and [[LINK]] marking where the CTA goes.';

alter table public.outbound_templates enable row level security;

-- Admin-only, and only through the service role in practice: these
-- mails go out under Niek's name, so the copy is not something a
-- signed-in professional should be able to read or rewrite.
drop policy if exists "outbound_templates_admin_all" on public.outbound_templates;
create policy "outbound_templates_admin_all"
  on public.outbound_templates for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and ('admin' = any (profiles.user_types) or profiles.admin_role is not null)
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and ('admin' = any (profiles.user_types) or profiles.admin_role is not null)
    )
  );
