-- Stippen per productcategorie als stand in plaats van aan/uit (admin ›
-- categorieën › producten, kolom Stippen):
--   auto  stippen; een soort die admins bijna altijd verwijderen wordt
--         vanzelf verborgen (detection_kind_review_stats)
--   show  stippen, nooit automatisch verbergen (was de vaste lijst in de
--         code: meubels, verlichting, buiten)
--   hide  stippen, maar meteen verborgen
--   off   geen stippen: de soort staat niet in de lijst voor Claude
--   null  overnemen van de bovenliggende categorie (bovenaan: auto)
--
-- Vervangt detect (migratie 362); die kolom wordt niet meer gelezen.

alter table public.product_categories
  add column if not exists detect_mode text
  check (detect_mode in ('auto', 'show', 'hide', 'off'));

comment on column public.product_categories.detect_mode is
  'Stippen bij herkennen: auto | show | hide | off; null = van de ouder (bovenaan auto).';

update public.product_categories set detect_mode = 'off' where detect = false;
update public.product_categories set detect_mode = 'show'
where parent_id is null and slug in ('furniture', 'lighting', 'outdoor');
