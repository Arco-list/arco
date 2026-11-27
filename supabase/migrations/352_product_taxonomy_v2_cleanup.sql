-- Opruimen na 351 (los te draaien, na de deploy van de code die op 351 leunt).
--
-- 1. product_collection_kinds bevat voortaan alleen subgroepen (niveau 2). De
--    oude soortrijen (niveau 3) en rijen naar een geparkeerde categorie gaan weg;
--    351 heeft de subgroepen er al naast gezet.
-- 2. Merkcategorieën die 351 heeft omgezet (de oude rij naar een geparkeerde
--    categorie). Afwerking en Bouw & techniek blijven staan: die zijn geparkeerd,
--    niet opgeheven, en kunnen terugkomen.

delete from public.product_collection_kinds k
using public.product_categories c
left join public.product_categories p on p.id = c.parent_id
where k.category_id = c.id
  and not (c.is_active and c.parent_id is not null and p.parent_id is null);

with recursive parked as (
  select id from public.product_categories where slug in ('finishes', 'construction') and parent_id is null
  union all
  select c.id from public.product_categories c join parked t on c.parent_id = t.id
)
delete from public.brand_categories b
using public.product_categories c
where b.category_id = c.id
  and not c.is_active
  and c.id not in (select id from parked);
