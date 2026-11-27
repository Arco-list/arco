-- Merkfunnel: Catalogued volgt de collecties, Passed vervangt de ster.
--
-- 1. is_curated (migratie 338, "in de selectie") volgt voortaan de status: uit
--    bij Suggested en Passed, aan bij elke andere. De kolom blijft, want
--    projecten, herkenning en inventarisatie lezen hem.
-- 2. De eerste collectie zet een Added-merk op Catalogued; de laatste weg zet
--    het terug. Latere stappen (Showcased, Listed…) blijven handwerk.
-- 3. Bestaande merken: zonder ster → Passed, Added met collecties → Catalogued.
-- De ster (is_featured) betekent vanaf nu: vooraan in de weergave.

create or replace function public.brands_curated_from_status()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.is_curated := new.status not in ('suggested', 'passed');
  end if;
  return new;
end $$;

drop trigger if exists brands_curated_from_status on public.brands;
create trigger brands_curated_from_status
  before insert or update of status on public.brands
  for each row execute function public.brands_curated_from_status();

create or replace function public.brand_status_from_collections()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.brands set status = 'catalogued' where id = new.brand_id and status = 'unclaimed';
    return new;
  end if;
  if not exists (select 1 from public.product_collections where brand_id = old.brand_id) then
    update public.brands set status = 'unclaimed' where id = old.brand_id and status = 'catalogued';
  end if;
  return old;
end $$;

drop trigger if exists brand_status_from_collections on public.product_collections;
create trigger brand_status_from_collections
  after insert or delete on public.product_collections
  for each row execute function public.brand_status_from_collections();

update public.brands set status = 'passed' where is_curated = false and status not in ('suggested', 'passed');
update public.brands b set status = 'catalogued'
where b.status = 'unclaimed' and exists (select 1 from public.product_collections c where c.brand_id = b.id);
