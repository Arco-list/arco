-- Badkamer › Douches: alleen Regendouches en Buitendouches. Douchebakken,
-- douchepanelen en douchegoten zijn vaak maatwerk, zelden een merk en
-- slecht te zien op een foto (0 merken, 0 producten, geen stip ooit bewaard;
-- Douchewanden stond al uit, migratie 358).
--
-- Geparkeerd (is_active = false); de paar verborgen stippen gaan naar
-- Douches met hun oude kind_slug, zodat de categorieën straks zonder
-- koppelingen te verwijderen zijn (bij de andere verwijderstappen).

update public.project_photo_detections
set category_id = (select id from public.product_categories where slug = 'showers')
where category_id in (select id from public.product_categories
                      where slug in ('shower-trays', 'shower-panels', 'shower-drains', 'shower-enclosures'));

-- Inventariskandidaten op deze soorten: naar Douches (de subgroep).
update public.brand_collection_candidates
set category_id = (select id from public.product_categories where slug = 'showers')
where category_id in (select id from public.product_categories
                      where slug in ('shower-trays', 'shower-panels', 'shower-drains', 'shower-enclosures'));

update public.product_categories set is_active = false
where slug in ('shower-trays', 'shower-panels', 'shower-drains');
