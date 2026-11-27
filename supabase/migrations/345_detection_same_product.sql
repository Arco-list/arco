-- Productherkenning: zelf koppelen dat twee stippen hetzelfde product zijn
-- ("Zelfde als…" in de beoordelingskaart). Stippen met dezelfde sleutel horen
-- altijd bij elkaar, ook als hun uitsneden te weinig op elkaar lijken voor de
-- automatische groepering (lib/recognition/grouping.ts, cosine ≥ 0,85) — de
-- mosterdgele fauteuil van verschillende kanten scoort 0,64–0,76.

alter table public.project_photo_detections add column if not exists same_product_key uuid;
create index if not exists project_photo_detections_same_product_idx
  on public.project_photo_detections (project_id, same_product_key) where same_product_key is not null;

comment on column public.project_photo_detections.same_product_key is
  'Zelf gekoppeld: stippen met dezelfde sleutel zijn hetzelfde product (op andere foto''s van het project) en vormen altijd één groep.';
