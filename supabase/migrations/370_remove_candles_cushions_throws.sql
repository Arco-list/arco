-- Woonaccessoires zonder Kaarsen & houders, Kussens en Plaids.
--   Kaarsen & houders → de twee kandelaars (Brokis Muffins, &Tradition
--                       Votive) en de kandidaat naar Objecten
--   Kussens, Plaids     → stonden al op Uit (geen stippen meer); de oude
--                       verborgen stippen en kandidaten naar Woonaccessoires
-- Stuc & kalkverf stond al uit en heeft geen koppelingen: alleen
-- verwijderen, bij de andere verwijderstappen. De drie hier gaan uit en
-- worden daar ook verwijderd.

update public.products set category_id = (select id from public.product_categories where slug = 'decorative-objects')
where category_id = (select id from public.product_categories where slug = 'candles');

update public.brand_collection_candidates set category_id = (select id from public.product_categories where slug = 'decorative-objects')
where category_id = (select id from public.product_categories where slug = 'candles');

update public.brand_collection_candidates set category_id = (select id from public.product_categories where slug = 'home-accessories')
where category_id in (select id from public.product_categories where slug in ('cushions', 'throws'));

-- Stippen: naar de subgroep, oude kind_slug blijft (allemaal verborgen).
update public.project_photo_detections set category_id = (select id from public.product_categories where slug = 'home-accessories')
where category_id in (select id from public.product_categories where slug in ('candles', 'cushions', 'throws'));

update public.product_image_embeddings e
set category_ids = array(
  select distinct case when x = (select id from public.product_categories where slug = 'candles')
                       then (select id from public.product_categories where slug = 'decorative-objects') else x end
  from unnest(e.category_ids) x
  where x not in (select id from public.product_categories where slug in ('cushions', 'throws')))
where e.category_ids && array(select id from public.product_categories where slug in ('candles', 'cushions', 'throws'));

update public.product_categories set is_active = false
where slug in ('candles', 'cushions', 'throws');

do $$
begin
  if exists (select 1 from public.products p join public.product_categories c on c.id = p.category_id where c.slug in ('candles', 'cushions', 'throws'))
     or exists (select 1 from public.project_photo_detections d join public.product_categories c on c.id = d.category_id where c.slug in ('candles', 'cushions', 'throws'))
     or exists (select 1 from public.product_collections pc join public.product_categories c on c.id = pc.category_id where c.slug in ('candles', 'cushions', 'throws')) then
    raise exception 'Kaarsen, kussens of plaids nog in gebruik';
  end if;
end $$;
