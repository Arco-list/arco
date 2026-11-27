-- Kranen zonder derde niveau, in de badkamer en de keuken.
--   Badkamer › Kranen: Wastafelkranen, Badkranen, Douchekranen & thermostaten
--   Keuken › Kranen:   Keukenkranen, Kokendwaterkranen, Spoelbakken
-- Merken verkopen kranen als één serie voor wastafel, bad en douche; alle
-- merken op een na hingen al aan Kranen zelf, geen collectie of product aan
-- een soort. Spoelbakken (geen stip, geen merk) gaat niet mee.
--
-- Alles gaat naar de subgroep, die daarmee eindcategorie wordt. Stippen die
-- nog meetellen (goedgekeurd, wacht op catalogus, onbekend, open) krijgen
-- de nieuwe kind_slug; verborgen en afgekeurde houden de oude, zodat ze
-- niet meetellen in de statistiek voor automatisch verbergen van Kranen.
-- De soorten gaan uit (geparkeerd); verwijderen volgt bij de andere
-- verwijderstappen.

create temp table tap_kinds (slug text primary key, target text) on commit drop;
insert into tap_kinds values
  ('basin-taps', 'bathroom-fittings'), ('bath-taps', 'bathroom-fittings'), ('shower-taps', 'bathroom-fittings'),
  ('kitchen-faucets', 'sinks-taps'), ('boiling-water-taps', 'sinks-taps'), ('kitchen-sinks', 'sinks-taps');

create temp table tap_map on commit drop as
select o.id as old_id, t.id as new_id, t.slug as new_slug
from tap_kinds k
join public.product_categories o on o.slug = k.slug
join public.product_categories t on t.slug = k.target;

insert into public.brand_categories (brand_id, category_id)
select distinct bc.brand_id, m.new_id
from public.brand_categories bc join tap_map m on m.old_id = bc.category_id
on conflict do nothing;

update public.products p set category_id = m.new_id from tap_map m where p.category_id = m.old_id;
update public.product_collections c set category_id = m.new_id from tap_map m where c.category_id = m.old_id;

insert into public.product_collection_kinds (collection_id, category_id, is_manual)
select distinct pck.collection_id, m.new_id, pck.is_manual
from public.product_collection_kinds pck join tap_map m on m.old_id = pck.category_id
on conflict do nothing;

update public.brand_collection_candidates x set category_id = m.new_id from tap_map m where x.category_id = m.old_id;

update public.project_photo_detections d
set category_id = m.new_id,
    kind_slug = case when d.review_status in ('hidden', 'rejected') then d.kind_slug else m.new_slug end
from tap_map m where d.category_id = m.old_id;

update public.product_image_embeddings e
set category_ids = array(
  select distinct coalesce(m.new_id, x)
  from unnest(e.category_ids) x left join tap_map m on m.old_id = x)
where e.category_ids && array(select old_id from tap_map);

update public.product_categories set is_active = false
where id in (select old_id from tap_map);

do $$
begin
  if exists (select 1 from public.products where category_id in (select old_id from tap_map))
     or exists (select 1 from public.project_photo_detections where category_id in (select old_id from tap_map))
     or exists (select 1 from public.product_categories c
                where c.parent_id in (select new_id from tap_map) and c.is_active) then
    raise exception 'Kraansoorten nog in gebruik of nog actief';
  end if;
end $$;
