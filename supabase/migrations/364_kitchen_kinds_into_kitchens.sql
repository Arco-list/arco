-- Keuken › Keukens zonder soorten: Kookeilanden, Vrijstaande
-- keukenelementen en Keukenkasten zijn vrijwel altijd maatwerk. Een merk dat
-- keukens voert (Henge, Bulthaup, Boffi) staat onder Keukens; de
-- overgebleven soort Keukens (fitted-kitchens) gaat daarin op, zodat Keukens
-- zelf de eindcategorie is (een stip hangt aan het diepste niveau).
--
-- Alles wat eraan hing gaat naar Keukens; open stippen op kookeilanden
-- worden verborgen als maatwerk. De categorieën gaan uit (geparkeerd); het
-- verwijderen volgt in 365, na de deploy.

create temp table kitchen_kinds on commit drop as
select id, slug from public.product_categories
where slug in ('kitchen-islands', 'freestanding-kitchen-units', 'cabinetry', 'fitted-kitchens');

create temp table kitchens_target on commit drop as
select id from public.product_categories where slug = 'kitchens';

-- Merken: ook onder Keukens (de oude koppelingen ruimt 365 op).
insert into public.brand_categories (brand_id, category_id)
select distinct bc.brand_id, (select id from kitchens_target)
from public.brand_categories bc join kitchen_kinds k on k.id = bc.category_id
on conflict do nothing;

update public.products set category_id = (select id from kitchens_target)
where category_id in (select id from kitchen_kinds);

update public.product_collections set category_id = (select id from kitchens_target)
where category_id in (select id from kitchen_kinds);

insert into public.product_collection_kinds (collection_id, category_id, is_manual)
select distinct pck.collection_id, (select id from kitchens_target), pck.is_manual
from public.product_collection_kinds pck join kitchen_kinds k on k.id = pck.category_id
on conflict do nothing;

update public.brand_collection_candidates set category_id = (select id from kitchens_target)
where category_id in (select id from kitchen_kinds);

-- Open stippen op kookeilanden: maatwerk (geen reviewed_by, dus buiten de
-- statistiek voor automatisch verbergen).
update public.project_photo_detections
set review_status = 'hidden', hidden_reason = 'bespoke', reviewed_at = now()
where category_id in (select id from kitchen_kinds) and review_status is null;

-- Stippen naar Keukens. kind_slug blijft zoals hij was: die stippen zijn
-- allemaal verborgen of afgekeurd en tellen anders mee in de statistiek van
-- Keukens (automatisch verbergen per soort).
update public.project_photo_detections set category_id = (select id from kitchens_target)
where category_id in (select id from kitchen_kinds);

-- Catalogusvectoren (geen FK): oude id's eruit, Keukens erin.
update public.product_image_embeddings e
set category_ids = array(
  select distinct x from unnest(
    array(select y from unnest(e.category_ids) y where y not in (select id from kitchen_kinds))
    || array[(select id from kitchens_target)]
  ) x)
where e.category_ids && array(select id from kitchen_kinds);

update public.product_categories set is_active = false
where id in (select id from kitchen_kinds);

do $$
begin
  if exists (select 1 from public.products where category_id in (select id from kitchen_kinds))
     or exists (select 1 from public.project_photo_detections where category_id in (select id from kitchen_kinds))
     or exists (select 1 from public.product_categories c where c.parent_id = (select id from kitchens_target) and c.is_active) then
    raise exception 'Keukensoorten nog in gebruik of nog actief';
  end if;
end $$;
