-- Productherkenning meetbaar maken (Notion › Product recognition, stap 0):
--   1. elke beoordeling bewaren (een nieuw oordeel overschrijft het vorige
--      in de detectie zelf; hier blijft alles staan);
--   2. per detectie en per voorstel vastleggen met welke instellingen het
--      tot stand kwam (model, prompt, aantal kandidaten, merkvoorrang);
--   3. een vaste testset van beoordeelde projecten en de uitkomst van elke
--      meting daarop (scripts/eval-recognition.ts).

-- 1. Logboek van beoordelingen.
create table if not exists public.project_photo_detection_reviews (
  id uuid primary key default gen_random_uuid(),
  -- Blijft staan als de detectie verdwijnt (opnieuw herkend, verwijderd).
  detection_id uuid references public.project_photo_detections(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete cascade,
  photo_id uuid references public.project_photos(id) on delete set null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  -- Toestand voor en na: review_status en het getoonde/goedgekeurde voorstel.
  before jsonb,
  after jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists project_photo_detection_reviews_project_idx on public.project_photo_detection_reviews(project_id, created_at);
create index if not exists project_photo_detection_reviews_detection_idx on public.project_photo_detection_reviews(detection_id);
alter table public.project_photo_detection_reviews enable row level security;
create policy project_photo_detection_reviews_admin_all on public.project_photo_detection_reviews for all using (is_admin_user()) with check (is_admin_user());
comment on table public.project_photo_detection_reviews is 'Elke beoordeling van een herkend product (goedkeuren, afwijzen, zoeken, verbergen, verplaatsen, …) met de toestand ervoor en erna.';

-- 2. Met welke instellingen een detectie / voorstel tot stand kwam.
alter table public.project_photo_detections add column if not exists pipeline jsonb;
alter table public.project_photo_detection_matches add column if not exists pipeline jsonb;
comment on column public.project_photo_detections.pipeline is 'Instellingen van het herkennen (lib/recognition/config.ts: versie, model, prompt).';
comment on column public.project_photo_detection_matches.pipeline is 'Instellingen van het koppelen (lib/recognition/config.ts: versie, embedding-model, kandidaten, merkvoorrang, oordeelmodel, prompt).';

-- 3. Testset en metingen.
create table if not exists public.recognition_eval_projects (
  project_id uuid primary key references public.projects(id) on delete cascade,
  note text,
  added_at timestamptz not null default now()
);
alter table public.recognition_eval_projects enable row level security;
create policy recognition_eval_projects_admin_all on public.recognition_eval_projects for all using (is_admin_user()) with check (is_admin_user());
comment on table public.recognition_eval_projects is 'Projecten in de vaste testset: hun beoordeelde producten zijn de meetlat voor elke aanpassing aan het koppelen.';

create table if not exists public.recognition_eval_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('retrieval', 'judge')),
  config jsonb not null,
  metrics jsonb not null,
  details jsonb,
  note text,
  created_at timestamptz not null default now()
);
alter table public.recognition_eval_runs enable row level security;
create policy recognition_eval_runs_admin_all on public.recognition_eval_runs for all using (is_admin_user()) with check (is_admin_user());
comment on table public.recognition_eval_runs is 'Uitkomst van een meting op de testset (scripts/eval-recognition.ts): instellingen, cijfers en per product wat er gebeurde.';
