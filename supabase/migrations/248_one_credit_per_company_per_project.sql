-- A company appears on a project once.
--
-- The only guard was UNIQUE (project_id, invited_email) WHERE invited_email <> '',
-- which misses both ways a duplicate actually happens: two people at the
-- same company invited under different addresses, and the photographer
-- credit, which carries no address at all and so falls outside the index
-- entirely. Both produced a team list naming the same business twice.
--
-- What distinguishes such rows is the service, so the merge keeps them:
-- the surviving row collects every category its duplicates carried. That
-- is the shape the data should have had from the start — one company,
-- several trades — and it is what the UI now writes.

-- ── 0. Photographer credits that could only have arrived by mistake.
--       The credit flow matched a company by domain or Places id without
--       checking who that company serves, so a homeowner-facing business
--       — an architect, a builder — could be credited as the project's
--       photographer. A photographer company on Arco is audience='pro',
--       so no genuine credit is removed here. These rows are dropped
--       rather than merged into step 2: the service was never chosen for
--       them, and merging would make the mistake permanent.
delete from project_professionals pp
using companies c, categories cat
where c.id = pp.company_id
  and cat.slug = 'photographer'
  and pp.invited_service_category_ids @> array[cat.id]
  and c.audience is distinct from 'pro';

-- ── 1. Pick the row that survives each (project_id, company_id) group.
--       The owner's own link first, then the oldest: whichever came with
--       the project rather than being added to it.
create temporary table pp_keep on commit drop as
select distinct on (project_id, company_id)
       id, project_id, company_id
from project_professionals
where company_id is not null
order by project_id, company_id, is_project_owner desc, created_at asc;

-- ── 2. Give the survivor every service its group carried.
update project_professionals pp
set invited_service_category_ids = u.cats
from (
  select k.id,
         (
           select array_agg(distinct cat)
           from project_professionals d
           cross join lateral unnest(coalesce(d.invited_service_category_ids, '{}'::uuid[])) as cat
           where d.project_id = k.project_id
             and d.company_id = k.company_id
         ) as cats
  from pp_keep k
  where exists (
    select 1 from project_professionals d
    where d.project_id = k.project_id
      and d.company_id = k.company_id
      and d.id <> k.id
  )
) u
where pp.id = u.id;

-- ── 3. Drop what was merged away.
delete from project_professionals pp
where pp.company_id is not null
  and not exists (select 1 from pp_keep k where k.id = pp.id);

-- ── 4. Hold the rule where it cannot be bypassed.
--       Partial, because rows without a company are invitations to an
--       address that has no company on Arco yet; those stay governed by
--       the existing per-email index.
create unique index if not exists project_professionals_one_per_company
  on public.project_professionals (project_id, company_id)
  where company_id is not null;
