-- Productdetails uit de collectiepagina die we toch al lezen (Notion ›
-- Product recognition): meer beelden per product om later projectfoto's
-- tegen te vergelijken, materialen en afwerkingen per collectie, en de
-- uitvoeringen die we samenvouwen tot één product als korte tekst.

-- Extra beelden per product (hoeken, uitvoeringen). products.image_url blijft
-- het hoofdbeeld voor de kaart; dit zijn de beelden ernaast. Los van
-- product_collection_photos: die voedt de galerij van de collectie, en
-- daar blijven productbeelden juist uit.
create table if not exists public.product_photos (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  source_url text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_photos_product_id_idx on public.product_photos(product_id, position);
alter table public.product_photos enable row level security;
create policy product_photos_admin_all on public.product_photos for all using (is_admin_user()) with check (is_admin_user());
comment on table public.product_photos is 'Extra beelden per product naast products.image_url, voor het herkennen van producten op projectfoto''s. url = opgeslagen kopie (of de bron als opslaan niet lukte), source_url = het origineel.';

-- Materialen en afwerkingen gelden meestal voor de hele collectie. Engels
-- hier, Nederlands in translations.nl.materials / .finishes.
alter table public.product_collections add column if not exists materials text[] not null default '{}';
alter table public.product_collections add column if not exists finishes text[] not null default '{}';
comment on column public.product_collections.materials is 'Materialen (Engels), bv. {glass,brass}. Nederlands in translations.nl.materials.';
comment on column public.product_collections.finishes is 'Afwerkingen en kleuren (Engels), bv. {white,black,gold leaf}. Nederlands in translations.nl.finishes.';

-- Maten en versies van één stuk vouwen we samen (Moon 60/80/120 → Moon);
-- dit bewaart ze als korte tekst.
alter table public.products add column if not exists variants text;
comment on column public.products.variants is 'Uitvoeringen die tot dit product zijn samengevouwen, kort: "Ø 60, 80, 120 cm".';
