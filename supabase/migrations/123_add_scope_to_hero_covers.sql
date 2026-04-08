-- Extend hero_covers with a scope column so the same table can back both the
-- homepage hero carousel and the /about page cover rotation. Existing rows
-- are backfilled to 'home'. The unique constraint moves from (slot) to
-- (scope, slot) so each scope can have its own 1-5 slots.

alter table public.hero_covers
  add column if not exists scope text;

update public.hero_covers
  set scope = 'home'
  where scope is null;

alter table public.hero_covers
  alter column scope set not null,
  alter column scope set default 'home';

alter table public.hero_covers
  drop constraint if exists hero_covers_slot_key;

alter table public.hero_covers
  add constraint hero_covers_scope_slot_key unique (scope, slot);

alter table public.hero_covers
  drop constraint if exists hero_covers_scope_check;

alter table public.hero_covers
  add constraint hero_covers_scope_check check (scope in ('home', 'about'));
