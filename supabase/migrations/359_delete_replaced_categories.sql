-- De categorieën die 351 heeft vervangen (opgesplitst, samengevoegd of
-- geschrapt) definitief weg. Na de deploy draaien: de oude code kan ze tot
-- dan nog kiezen bij het inventariseren.
--
-- Wat eraan hangt:
--   brand_categories, product_collection_kinds  → cascade (351 zette de
--                                                 nieuwe rijen er al naast)
--   products, stippen, collecties               → set null; de controle
--                                                 hieronder stopt als er nog
--                                                 iets aan hangt
--   inventariskandidaten                         → eerst omgezet, zoals in 351
--
-- Geparkeerd en NIET verwijderd: Afwerking en Bouw & techniek (met hun
-- stippen, collecties en merken), Plantenbakken, Douchewanden.

create temp table replaced (slug text primary key, target text) on commit drop;
insert into replaced (slug, target) values
  ('sofas-armchairs', null), ('tables-chairs', null), ('indoor-lighting', null),
  ('kitchen-accessories', null), ('bathroom-fixtures', null), ('bathroom-accessories', null),
  ('outdoor-furniture', null), ('textiles', null),
  ('worktops', 'countertops'), ('splashbacks', 'countertops'),
  ('swimming-pools', 'pools'), ('indoor-pools', 'pools'), ('minipools', 'pools'), ('pool-covers', 'pools'),
  ('outdoor-fireplaces', 'fire-heat'), ('fire-pits', 'fire-heat'), ('outdoor-heating', 'fire-heat'),
  ('garden-rooms', 'pergolas'),
  ('gas-fireplaces', 'indoor-fireplaces'), ('wood-fireplaces', 'indoor-fireplaces'),
  ('electric-fireplaces', 'indoor-fireplaces'), ('bioethanol-fireplaces', 'indoor-fireplaces'),
  ('art-prints', 'art'), ('sculptures', 'art'),
  ('bathroom-lighting', 'wall-lamp'),
  ('drawer-organisers', null), ('kitchen-rails', null), ('waste-systems', null), ('upholstery-fabrics', null);

-- Kandidaten die sinds 351 nog op een oude categorie zijn gezet.
update public.brand_collection_candidates x
set category_id = (select id from public.product_categories where slug = r.target)
from replaced r join public.product_categories o on o.slug = r.slug
where x.category_id = o.id;

do $$
begin
  if exists (
    select 1 from public.product_categories c join replaced r on r.slug = c.slug
    where c.is_active
       or exists (select 1 from public.product_categories k where k.parent_id = c.id and k.slug not in (select slug from replaced))
       or exists (select 1 from public.products where category_id = c.id)
       or exists (select 1 from public.project_photo_detections where category_id = c.id)
       or exists (select 1 from public.product_collections where category_id = c.id)
  ) then
    raise exception 'Een vervangen categorie is nog actief, heeft kinderen of koppelingen — eerst nakijken';
  end if;
end $$;

-- Categorie-id's op catalogusvectoren (geen FK) ook opschonen.
update public.product_image_embeddings e
set category_ids = array(select x from unnest(e.category_ids) x
                         where x not in (select c.id from public.product_categories c join replaced r on r.slug = c.slug))
where e.category_ids && array(select c.id from public.product_categories c join replaced r on r.slug = c.slug);

delete from public.product_categories c using replaced r where c.slug = r.slug;
