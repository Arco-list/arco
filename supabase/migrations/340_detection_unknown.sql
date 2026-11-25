-- Productherkenning: "onbekend" — wel een product (de stip blijft), maar niet
-- duidelijk welk. Telt als beoordeeld; later de vraag aan de projecteigenaar
-- ("Welk product is dit?").

alter table public.project_photo_detections drop constraint if exists project_photo_detections_review_status_check;
alter table public.project_photo_detections add constraint project_photo_detections_review_status_check
  check (review_status in ('approved', 'rejected', 'missing', 'hidden', 'unknown'));
comment on column public.project_photo_detections.review_status is
  'null: te beoordelen; approved: gekoppeld (zie de goedgekeurde match); rejected: geen van de voorstellen; missing: staat niet in de catalogus (missing_brand/missing_name); hidden: niet taggen; unknown: wel een product, niet duidelijk welk.';
