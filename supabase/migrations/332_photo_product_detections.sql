-- Productherkenning, stap 1 (Notion › Product recognition): per projectfoto
-- de belangrijkste producten (hooguit drie) met soort, kader en een korte
-- beschrijving. Dit zijn detecties: wat er te zien is, los van welk merk
-- of welke collectie het is (dat koppelen is stap 3). Voorlopig alleen
-- zichtbaar voor admins.

-- De analyse per foto: wachtrij, batch bij Claude en de uitkomst.
create table if not exists public.project_photo_analyses (
  photo_id uuid primary key references public.project_photos(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'submitted', 'done', 'failed')),
  batch_id text,
  model text,
  -- De ruimte die Claude ziet; een voorstel naast project_photos.feature_id.
  room text,
  error text,
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_photo_analyses_status_idx on public.project_photo_analyses(status);
create index if not exists project_photo_analyses_project_idx on public.project_photo_analyses(project_id);
alter table public.project_photo_analyses enable row level security;
create policy project_photo_analyses_admin_all on public.project_photo_analyses for all using (is_admin_user()) with check (is_admin_user());
comment on table public.project_photo_analyses is 'Productherkenning per projectfoto: status van de analyse (queued → submitted → done/failed), de batch bij Claude en de voorgestelde ruimte.';

-- De producten op een foto.
create table if not exists public.project_photo_detections (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.project_photos(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  rank smallint not null,
  category_id uuid references public.product_categories(id) on delete set null,
  kind_slug text,
  label text not null,
  -- Kader als fractie van breedte en hoogte (0 = links/boven).
  box_x0 real not null,
  box_y0 real not null,
  box_x1 real not null,
  box_y1 real not null,
  description text,
  brand_cues text,
  created_at timestamptz not null default now()
);
create index if not exists project_photo_detections_photo_idx on public.project_photo_detections(photo_id, rank);
create index if not exists project_photo_detections_project_idx on public.project_photo_detections(project_id);
create index if not exists project_photo_detections_category_idx on public.project_photo_detections(category_id);
alter table public.project_photo_detections enable row level security;
create policy project_photo_detections_admin_all on public.project_photo_detections for all using (is_admin_user()) with check (is_admin_user());
comment on table public.project_photo_detections is 'Herkende producten op een projectfoto (hooguit drie): soort, kader (fracties), beschrijving en zichtbare merkhint. Nog niet gekoppeld aan merk of collectie.';
