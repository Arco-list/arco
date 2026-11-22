-- Focuspunt van een collectiefoto: de hero vult de volle breedte en snijdt
-- bij rond het product (lib/collections/hero-focus).
alter table public.product_collection_photos
  add column if not exists focus_x real check (focus_x between 0 and 1),
  add column if not exists focus_y real check (focus_y between 0 and 1);
comment on column public.product_collection_photos.focus_x is 'Focuspunt voor de hero (0 = links, 1 = rechts): het product blijft in beeld bij bijsnijden.';
comment on column public.product_collection_photos.focus_y is 'Focuspunt voor de hero (0 = boven, 1 = onder).';
