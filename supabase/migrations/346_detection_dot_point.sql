-- Productherkenning: de plek van de stip los van het kader. Het midden van
-- het kader valt vaak op iets dat ervoor staat (een stoel voor de tafel);
-- Claude geeft nu een punt óp het product, op een goed zichtbaar deel (het
-- tafelblad, de zitting, de kap). Fracties van de foto (0–1); null bij
-- oudere detecties: dan het midden van het kader.

alter table public.project_photo_detections
  add column if not exists dot_x real,
  add column if not exists dot_y real;

comment on column public.project_photo_detections.dot_x is 'Plek van de stip (0–1, van links); null: midden van het kader.';
comment on column public.project_photo_detections.dot_y is 'Plek van de stip (0–1, van boven); null: midden van het kader.';
