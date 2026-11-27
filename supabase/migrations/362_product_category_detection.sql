-- Productherkenning per categorie, te beheren in admin › categorieën ›
-- producten:
--   detect       uit = geen stippen voor deze categorie en alles eronder (de
--                soorten staan dan niet in de lijst voor Claude);
--   detect_hint  extra context voor Claude bij deze categorie (en alles
--                eronder), achter de regel in de categorielijst.
-- Vervangt de vaste lijst in de code (kussens, plaids, keukentextiel).

alter table public.product_categories
  add column if not exists detect boolean not null default true,
  add column if not exists detect_hint text;

comment on column public.product_categories.detect is
  'Stippen plaatsen voor deze categorie en alles eronder (productherkenning).';
comment on column public.product_categories.detect_hint is
  'Extra context voor de herkenning bij deze categorie en alles eronder.';

update public.product_categories set detect = false
where slug in ('cushions', 'throws', 'kitchen-textiles', 'textiles');
