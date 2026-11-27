-- Eén opruimronde na 364–370 (vervangt het losse 365). Draaien in de
-- Supabase SQL Editor, in één keer. Alles of niets: stopt de controle, dan
-- verandert er niets.
--
-- 1. Koppelingen naar uitgezette categorieën (de regels van 352, opnieuw:
--    364–370 zetten nieuwe rijen al naast de oude).
-- 2. De uitgezette categorieën definitief weg: keukensoorten (364),
--    doucheonderdelen (366), kraansoorten (367), Badkamermeubels en soorten
--    (368), spa-soorten (369), kaarsen/kussens/plaids (370) en Stuc &
--    kalkverf. Plantenbakken blijft geparkeerd (heeft nog een product en
--    stippen).
-- 3. De kolom detect (vervangen door detect_mode, 363).

begin;

-- 1a. Collectie-subgroepen: alleen actieve subgroepen (niveau 2).
delete from public.product_collection_kinds k
using public.product_categories c
left join public.product_categories p on p.id = c.parent_id
where k.category_id = c.id
  and not (c.is_active and c.parent_id is not null and p.parent_id is null);

-- 1b. Merkkoppelingen naar uitgezette categorieën, behalve Afwerking en
--     Bouw & techniek (geparkeerd, kunnen terugkomen).
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

-- 2. De categorieën.
create temp table removed (slug text primary key) on commit drop;
insert into removed values
  ('kitchen-islands'), ('freestanding-kitchen-units'), ('cabinetry'), ('fitted-kitchens'),
  ('shower-trays'), ('shower-enclosures'), ('shower-panels'), ('shower-drains'),
  ('basin-taps'), ('bath-taps'), ('shower-taps'), ('kitchen-faucets'), ('boiling-water-taps'), ('kitchen-sinks'),
  ('vanities'), ('vanity-units'), ('vanity-tops'), ('bathroom-cabinets'), ('bathroom-mirrors'), ('towel-radiators'),
  ('hot-tubs'), ('swim-spas'),
  ('candles'), ('cushions'), ('throws'),
  ('plaster-paint');

do $$
begin
  if exists (
    select 1 from public.product_categories c join removed r on r.slug = c.slug
    where c.is_active
       or exists (select 1 from public.product_categories k where k.parent_id = c.id and k.slug not in (select slug from removed))
       or exists (select 1 from public.products where category_id = c.id)
       or exists (select 1 from public.project_photo_detections where category_id = c.id)
       or exists (select 1 from public.product_collections where category_id = c.id)
       or exists (select 1 from public.brand_collection_candidates where category_id = c.id)
  ) then
    raise exception 'Een categorie is nog actief, heeft kinderen of koppelingen — er is niets veranderd';
  end if;
end $$;

-- Catalogusvectoren (geen FK).
update public.product_image_embeddings e
set category_ids = array(select x from unnest(e.category_ids) x
                         where x not in (select c.id from public.product_categories c join removed r on r.slug = c.slug))
where e.category_ids && array(select c.id from public.product_categories c join removed r on r.slug = c.slug);

-- Eerst de soorten, dan Badkamermeubels (de ouder van een paar ervan).
delete from public.product_categories c using removed r where c.slug = r.slug and c.slug <> 'vanities';
delete from public.product_categories where slug = 'vanities';

-- 3. Vervangen door detect_mode.
alter table public.product_categories drop column if exists detect;

commit;
