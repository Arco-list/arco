-- Productcategorieën v2: 7 hoofdgroepen, 45 subgroepen.
--
--   Meubels      Banken, Fauteuils, Tafels, Stoelen, Kasten, Slaapkamer, Werkplek
--   Verlichting  Hanglampen, Plafondlampen, Wandlampen, Vloerlampen, Tafellampen,
--                Spots, Railverlichting, Lichtlijnen, Buitenverlichting
--   Keuken       Keukens, Werkbladen, Kranen, Apparatuur, Tafel & koken
--   Badkamer     Wastafels, Toiletten, Baden, Douches, Kranen, Badkamermeubels
--   Wellness     Sauna & stoom, Spa's, Zwembaden, Fitness
--   Buiten       Loungemeubels, Ligbedden, Tuintafels, Tuinstoelen, Buitenkoken,
--                Buitenhaarden, Overkappingen, Parasols & zonwering, Tuinaccessoires
--   Wonen        Haarden, Woonaccessoires, Vloerkleden, Raamdecoratie, Kunst
--
-- Een subgroep zonder soorten is zelf de eindcategorie (Hanglampen, Wastafels…).
-- Waar zo'n eindcategorie al als soort bestond, schuift die soort een niveau op:
-- zelfde id en slug, dus producten, stippen en collecties blijven eraan hangen.
--
-- Afwerking en Bouw & techniek worden geparkeerd (is_active = false), op Haarden
-- (naar Wonen) en Buitenzonwering (naar Parasols & zonwering) na. Er wordt niets
-- verwijderd: geparkeerde categorieën houden hun koppelingen.
--
-- Het model daarna:
--   collectie   één hoofdsubgroep (product_collections.category_id, niveau 2) plus
--               één of meer subgroepen in product_collection_kinds (niveau 2)
--   product     het diepste niveau: de soort, of de subgroep als die geen soorten heeft
--   stip        idem
--
-- De oude rijen van niveau 3 in product_collection_kinds en de omgezette
-- merkcategorieën ruimt 352 op (DELETE — los te draaien).

-- 0. Handmatig gekozen subgroepen van een collectie overleven het herberekenen.
alter table public.product_collection_kinds
  add column if not exists is_manual boolean not null default false;

-- 1. Nieuwe subgroepen
insert into public.product_categories (slug, name, name_nl, parent_id, order_index, is_active)
select v.slug, v.name, v.name_nl, p.id, v.ord, true
from (values
  ('sofas',          'Sofas',            'Banken',        'furniture', 1),
  ('armchairs',      'Armchairs',        'Fauteuils',     'furniture', 2),
  ('tables',         'Tables',           'Tafels',        'furniture', 3),
  ('chairs',         'Chairs',           'Stoelen',       'furniture', 4),
  ('toilets-bidets', 'Toilets',          'Toiletten',     'bathroom',  2),
  ('outdoor-lounge', 'Lounge furniture', 'Loungemeubels', 'outdoor',   1),
  ('garden-chairs',  'Garden chairs',    'Tuinstoelen',   'outdoor',   4)
) v(slug, name, name_nl, parent, ord)
join public.product_categories p on p.slug = v.parent
on conflict (slug) do nothing;

-- 2. Plaats en volgorde
update public.product_categories c
set parent_id = p.id, order_index = v.ord
from (values
  -- Meubels
  ('sofa','sofas',1), ('corner-sofas','sofas',2), ('sofa-beds','sofas',3), ('chaise-longues','sofas',4), ('daybeds','sofas',5),
  ('armchair','armchairs',1), ('lounge-chair','armchairs',2), ('poufs','armchairs',3),
  ('dining-table','tables',1), ('coffee-table','tables',2), ('side-table','tables',3), ('console','tables',4),
  ('dining-chair','chairs',1), ('bar-stool','chairs',2), ('bench','chairs',3),
  ('storage','furniture',5), ('bedroom','furniture',6), ('workspace','furniture',7),
  -- Verlichting: binnen zonder derde niveau
  ('pendant','lighting',1), ('ceiling-light','lighting',2), ('wall-lamp','lighting',3), ('floor-lamp','lighting',4),
  ('table-lamp','lighting',5), ('spotlights','lighting',6), ('track-lighting','lighting',7), ('linear-lighting','lighting',8),
  ('outdoor-lighting','lighting',9),
  -- Keuken
  ('kitchens','kitchen',1), ('countertops','kitchen',2), ('sinks-taps','kitchen',3), ('kitchen-appliances','kitchen',4), ('tableware-cookware','kitchen',5),
  ('kitchen-faucets','sinks-taps',1), ('boiling-water-taps','sinks-taps',2), ('kitchen-sinks','sinks-taps',3),
  ('chopping-boards','tableware-cookware',7), ('kitchen-textiles','tableware-cookware',8),
  -- Badkamer
  ('washbasins','bathroom',1), ('bathtubs','bathroom',3), ('showers','bathroom',4), ('bathroom-fittings','bathroom',5), ('vanities','bathroom',6),
  ('toilets','toilets-bidets',1), ('bidets','toilets-bidets',2),
  ('shower-trays','showers',1), ('shower-enclosures','showers',2), ('rain-showers','showers',3), ('shower-panels','showers',4),
  ('shower-drains','showers',5), ('outdoor-showers','showers',6),
  ('towel-radiators','vanities',5), ('bath-accessories','vanities',6),
  -- Wellness
  ('sauna-steam','wellness',1), ('spas','wellness',2), ('pools','wellness',3), ('fitness','wellness',4),
  -- Buiten
  ('outdoor-lounge-seating','outdoor-lounge',1), ('outdoor-sofas','outdoor-lounge',2), ('outdoor-lounge-chairs','outdoor-lounge',3), ('outdoor-daybeds','outdoor-lounge',4),
  ('sun-loungers','outdoor',2), ('outdoor-tables','outdoor',3),
  ('outdoor-chairs','garden-chairs',1), ('outdoor-benches','garden-chairs',2), ('outdoor-bar-stools','garden-chairs',3),
  ('outdoor-cooking','outdoor',5), ('fire-heat','outdoor',6), ('pergolas','outdoor',7), ('shade','outdoor',8), ('garden-accessories','outdoor',9),
  ('parasols','shade',1), ('awnings','shade',2), ('shade-sails','shade',3), ('exterior-shading','shade',4),
  -- Wonen
  ('indoor-fireplaces','decor',1), ('home-accessories','decor',2), ('rugs','decor',3), ('window-treatments','decor',4), ('art','decor',5),
  ('cushions','home-accessories',6), ('throws','home-accessories',7)
) v(slug, parent, ord)
join public.product_categories p on p.slug = v.parent
where c.slug = v.slug;

-- 3. Namen
update public.product_categories c
set name = v.name, name_nl = v.name_nl
from (values
  ('spotlights', 'Spotlights',         'Spots'),
  ('sinks-taps', 'Taps',               'Kranen'),
  ('vanities',   'Bathroom furniture', 'Badkamermeubels'),
  ('fire-heat',  'Outdoor fireplaces', 'Buitenhaarden'),
  ('pergolas',   'Canopies',           'Overkappingen'),
  ('shade',      'Parasols & awnings', 'Parasols & zonwering'),
  ('decor',      'Living',             'Wonen')
) v(slug, name, name_nl)
where c.slug = v.slug;

-- 4. Parkeren
update public.product_categories
set is_active = false
where slug in (
  -- opgesplitst of opgeheven subgroepen
  'sofas-armchairs', 'tables-chairs', 'indoor-lighting', 'kitchen-accessories',
  'bathroom-fixtures', 'bathroom-accessories', 'outdoor-furniture', 'textiles',
  -- soorten onder wat nu een eindcategorie is
  'worktops', 'splashbacks', 'swimming-pools', 'indoor-pools', 'minipools', 'pool-covers',
  'outdoor-fireplaces', 'fire-pits', 'outdoor-heating', 'garden-rooms',
  'gas-fireplaces', 'wood-fireplaces', 'electric-fireplaces', 'bioethanol-fireplaces',
  'art-prints', 'sculptures',
  -- geschrapt
  'drawer-organisers', 'kitchen-rails', 'waste-systems', 'bathroom-lighting', 'upholstery-fabrics'
);

-- Afwerking en Bouw & techniek met alles wat er (na stap 2) nog onder hangt.
with recursive tree as (
  select id from public.product_categories where slug in ('finishes', 'construction') and parent_id is null
  union all
  select c.id from public.product_categories c join tree t on c.parent_id = t.id
)
update public.product_categories set is_active = false where id in (select id from tree);

-- 5. Waar de koppelingen van geparkeerde categorieën heen gaan.
create temp table cat_remap (old_id uuid primary key, new_id uuid not null) on commit drop;

insert into cat_remap (old_id, new_id)
select o.id, n.id
from (values
  ('worktops','countertops'), ('splashbacks','countertops'),
  ('swimming-pools','pools'), ('indoor-pools','pools'), ('minipools','pools'), ('pool-covers','pools'),
  ('outdoor-fireplaces','fire-heat'), ('fire-pits','fire-heat'), ('outdoor-heating','fire-heat'),
  ('garden-rooms','pergolas'),
  ('gas-fireplaces','indoor-fireplaces'), ('wood-fireplaces','indoor-fireplaces'),
  ('electric-fireplaces','indoor-fireplaces'), ('bioethanol-fireplaces','indoor-fireplaces'),
  ('art-prints','art'), ('sculptures','art'),
  ('bathroom-lighting','wall-lamp')
) v(o, n)
join public.product_categories o on o.slug = v.o
join public.product_categories n on n.slug = v.n;

-- De rest: naar de dichtstbijzijnde actieve voorouder. Afwerking en Bouw &
-- techniek blijven zoals ze zijn — geparkeerd met koppelingen en al.
insert into cat_remap (old_id, new_id)
select c.id, case when p.is_active then p.id else g.id end
from public.product_categories c
left join public.product_categories p on p.id = c.parent_id
left join public.product_categories g on g.id = p.parent_id
where not c.is_active
  and c.id not in (select old_id from cat_remap)
  and coalesce(g.slug, p.slug, c.slug) not in ('finishes', 'construction')
  and (p.is_active or g.is_active);

update public.products x set category_id = r.new_id from cat_remap r where x.category_id = r.old_id;
-- kind_slug mee: project_detection_kind_stats (auto-verbergen) telt per slug.
update public.project_photo_detections x set category_id = r.new_id, kind_slug = n.slug
from cat_remap r join public.product_categories n on n.id = r.new_id
where x.category_id = r.old_id;
update public.brand_collection_candidates x set category_id = r.new_id from cat_remap r where x.category_id = r.old_id;
update public.product_collections x set category_id = r.new_id from cat_remap r where x.category_id = r.old_id;

-- De 21 Flos-producten die op "Binnenverlichting" hingen (nu Verlichting): op naam
-- in hun soort, vóór de hoofdsubgroep van de collectie wordt bepaald.
update public.products x set category_id = n.id
from (values
  ('Arrangements - 1 element','pendant'), ('Arrangements - 2 elements','pendant'),
  ('Bellhop 125 Bollard','bollard-lights'), ('Bellhop Outdoor','outdoor-table-lamps'),
  ('Captain Flint Floor Outdoor','outdoor-floor-lamps'), ('Captain Flint Wall Outdoor','outdoor-wall-lamps'),
  ('Coordinates Ceiling','ceiling-light'), ('Coordinates Ceiling 4','ceiling-light'), ('Coordinates Suspension','pendant'),
  ('Glo-Ball Wall','wall-lamp'),
  ('IC Lights Ceiling/Wall Outdoor','outdoor-wall-lamps'), ('IC Lights Floor','floor-lamp'), ('IC Lights Floor Outdoor','outdoor-floor-lamps'),
  ('In Vitro Bollard','bollard-lights'), ('In Vitro Ceiling','outdoor-ceiling-lamps'),
  ('In Vitro Suspension','outdoor-ceiling-lamps'), ('In Vitro Wall','outdoor-wall-lamps'),
  ('Ktribe Table 1','table-lamp'), ('Noctambule Floor 3 High Cylinder Bowl Big Base','floor-lamp'),
  ('Skynest Ceiling','ceiling-light'), ('Taraxacum 1','pendant')
) v(product, kind)
join public.product_categories n on n.slug = v.kind
where x.name = v.product
  and x.category_id = (select id from public.product_categories where slug = 'lighting');

insert into public.brand_categories (brand_id, category_id, position)
select b.brand_id, r.new_id, min(b.position)
from public.brand_categories b join cat_remap r on r.old_id = b.category_id
group by b.brand_id, r.new_id
on conflict (brand_id, category_id) do nothing;

-- 6. Subgroep (niveau 2) van elke actieve categorie; null voor een hoofdgroep.
create temp table cat_l2 on commit drop as
select c.id, case when c.parent_id is null then null when p.parent_id is null then c.id else p.id end as grp
from public.product_categories c
left join public.product_categories p on p.id = c.parent_id
where c.is_active;

-- 7. Hoofdsubgroep van een collectie: de subgroep met de meeste producten; zonder
-- producten de eerste soort; anders de subgroep van de huidige categorie. Wat op
-- een hoofdgroep blijft hangen, staat in het nakijklijstje.
with prod as (
  select pr.collection_id, l.grp, count(*) as n
  from public.products pr join cat_l2 l on l.id = pr.category_id
  where pr.collection_id is not null and l.grp is not null
  group by 1, 2
),
by_products as (
  select distinct on (p.collection_id) p.collection_id, p.grp
  from prod p join public.product_categories g on g.id = p.grp
  order by p.collection_id, p.n desc, g.order_index
),
by_kinds as (
  select distinct on (k.collection_id) k.collection_id, l.grp
  from public.product_collection_kinds k
  join cat_l2 l on l.id = coalesce((select new_id from cat_remap r where r.old_id = k.category_id), k.category_id)
  where l.grp is not null
  order by k.collection_id, k.position
),
pick as (
  select c.id, coalesce(bp.grp, bk.grp, l.grp) as grp
  from public.product_collections c
  left join by_products bp on bp.collection_id = c.id
  left join by_kinds bk on bk.collection_id = c.id
  left join cat_l2 l on l.id = c.category_id
)
update public.product_collections c
set category_id = pick.grp
from pick
where pick.id = c.id and pick.grp is not null and c.category_id is distinct from pick.grp;

-- 8. Alle subgroepen van een collectie: hoofdsubgroep, die van de producten, en die
-- van de soorten die er al aan hingen.
insert into public.product_collection_kinds (collection_id, category_id, position, is_manual)
select collection_id, grp, (row_number() over (partition by collection_id order by prio, n desc, ord)) - 1, false
from (
  select distinct on (s.collection_id, s.grp) s.collection_id, s.grp, s.prio, s.n, g.order_index as ord
  from (
    select c.id as collection_id, c.category_id as grp, 0 as prio, 0::bigint as n
    from public.product_collections c join cat_l2 l on l.id = c.category_id and l.grp = c.category_id
    union all
    select pr.collection_id, l.grp, 1, count(*)
    from public.products pr join cat_l2 l on l.id = pr.category_id
    where pr.collection_id is not null and l.grp is not null
    group by 1, 2
    union all
    select k.collection_id, l.grp, 2, 0
    from public.product_collection_kinds k
    join cat_l2 l on l.id = coalesce((select new_id from cat_remap r where r.old_id = k.category_id), k.category_id)
    where l.grp is not null
  ) s
  join public.product_categories g on g.id = s.grp
  order by s.collection_id, s.grp, s.prio, s.n desc
) d
on conflict (collection_id, category_id) do nothing;

-- 9. Beeldherkenning: de categorieën op elke catalogusvector opnieuw zetten
-- (indexCatalogImages slaat bestaande vectoren over en zou ze laten staan).
with col_cats as (
  select c.id,
         array(select distinct x from unnest(
           array_append(array(select k.category_id from public.product_collection_kinds k
                              join cat_l2 l on l.id = k.category_id and l.grp = k.category_id
                              where k.collection_id = c.id), c.category_id)) x where x is not null) as ids
  from public.product_collections c
)
update public.product_image_embeddings e
set category_ids = array(select distinct x from unnest(
      case when e.source in ('product', 'product_photo')
           then array_append(coalesce(cc.ids, '{}'::uuid[]), pr.category_id)
           else coalesce(cc.ids, '{}'::uuid[]) end) x where x is not null)
from public.product_image_embeddings e2
left join public.products pr on pr.id = e2.product_id
left join col_cats cc on cc.id = e2.collection_id
where e2.id = e.id;

-- 10. Stippen op wat we niet meer voeren (Afwerking, Bouw & techniek) en die nog
-- niet of als "onbekend" beoordeeld zijn: verbergen, reden "voeren we niet".
-- Wat al gekoppeld of verborgen is, blijft zoals het is.
with recursive parked as (
  select id from public.product_categories where slug in ('finishes', 'construction') and parent_id is null
  union all
  select c.id from public.product_categories c join parked t on c.parent_id = t.id
)
update public.project_photo_detections d
set review_status = 'hidden', hidden_reason = 'not_carried'
where d.category_id in (select id from parked)
  and (d.review_status is null or d.review_status = 'unknown')
  and not exists (select 1 from public.project_detection_links l where l.detection_id = d.id);

-- 11. Controle: geen actieve categorie onder een geparkeerde.
do $$
begin
  if exists (
    select 1 from public.product_categories c join public.product_categories p on p.id = c.parent_id
    where c.is_active and not p.is_active
  ) then
    raise exception 'Actieve categorie onder een geparkeerde ouder';
  end if;
end $$;
