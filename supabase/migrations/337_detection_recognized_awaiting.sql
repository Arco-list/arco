-- Productherkenning: een product dat Claude herkent maar dat (nog) niet in de
-- catalogus staat (de Flos Taccia, het B&B Italia Tufty-Bed).
--
-- 1. Wat Claude herkent, los van de kandidaten: merk, product, de site van het
--    merk, en het merk in de catalogus als dat er al is.
-- 2. "Wacht op de catalogus": een admin bevestigt (review_status 'missing',
--    missing_brand / missing_name, missing_brand_id). Zodra er van dat merk
--    nieuwe catalogusbeelden geïndexeerd zijn (na matched_at), koppelt de
--    cron de stip opnieuw; met een voorstel staat hij weer op te beoordelen.

alter table public.project_photo_detections add column if not exists recognized_brand text;
alter table public.project_photo_detections add column if not exists recognized_product text;
alter table public.project_photo_detections add column if not exists recognized_website text;
alter table public.project_photo_detections add column if not exists recognized_brand_id uuid references public.brands(id) on delete set null;
alter table public.project_photo_detections add column if not exists missing_brand_id uuid references public.brands(id) on delete set null;
alter table public.project_photo_detections add column if not exists matched_at timestamptz;
create index if not exists project_photo_detections_awaiting_idx on public.project_photo_detections(missing_brand_id) where review_status = 'missing';

comment on column public.project_photo_detections.recognized_brand is 'Het merk dat Claude in de uitsnede herkent, ook als het niet in de catalogus staat.';
comment on column public.project_photo_detections.recognized_product is 'Het product of de collectie die Claude herkent (bijv. "Taccia").';
comment on column public.project_photo_detections.recognized_website is 'De site van het herkende merk volgens Claude; voorstel bij "merk inventariseren".';
comment on column public.project_photo_detections.recognized_brand_id is 'Het herkende merk in de catalogus, als het er al is (op naam).';
comment on column public.project_photo_detections.missing_brand_id is 'Bevestigd "niet in de catalogus": het merk waarop de stip wacht. Nieuwe beelden van dit merk → opnieuw koppelen.';
comment on column public.project_photo_detections.matched_at is 'Laatste keer gekoppeld (oordeel van Claude verwerkt).';
