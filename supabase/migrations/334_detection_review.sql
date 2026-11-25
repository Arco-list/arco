-- Productherkenning, beoordeling (Notion › Product recognition): een admin
-- keurt per herkend product het voorstel goed of af, kiest een andere
-- kandidaat, zoekt zelf in de catalogus, noteert wat er (nog) niet in staat,
-- verbergt wat niet getagd hoeft te worden, versleept de stip of voegt er
-- zelf een toe.

alter table public.project_photo_detections add column if not exists review_status text
  check (review_status in ('approved', 'rejected', 'missing', 'hidden'));
comment on column public.project_photo_detections.review_status is
  'null: te beoordelen; approved: gekoppeld (zie de goedgekeurde match); rejected: geen van de voorstellen; missing: staat niet in de catalogus (missing_brand/missing_name); hidden: niet taggen.';
alter table public.project_photo_detections add column if not exists missing_brand text;
alter table public.project_photo_detections add column if not exists missing_name text;
alter table public.project_photo_detections add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.project_photo_detections add column if not exists reviewed_at timestamptz;
-- ai: door Claude herkend; manual: door een admin op de foto gezet.
alter table public.project_photo_detections add column if not exists source text not null default 'ai'
  check (source in ('ai', 'manual'));
create index if not exists project_photo_detections_review_idx on public.project_photo_detections(project_id, review_status);

-- Een zelf gekozen product of collectie is een match met source 'manual'.
alter table public.project_photo_detection_matches drop constraint if exists project_photo_detection_matches_source_check;
alter table public.project_photo_detection_matches add constraint project_photo_detection_matches_source_check
  check (source in ('ai', 'manual'));
