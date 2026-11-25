-- Productherkenning, stap 3 (Notion › Product recognition): een herkend
-- product op een projectfoto koppelen aan een collectie of product uit de
-- catalogus. Schaalt naar duizenden collecties door eerst op beeld te
-- zoeken (Voyage multimodal embeddings + pgvector) en daarna Claude de
-- beste kandidaten te laten beoordelen.

-- 1. De catalogus als vectoren: één per productbeeld (hoofdbeeld, extra
--    beelden en productfoto's van een collectie; geen sfeerbeelden, daar
--    staat te veel omheen).
create table if not exists public.product_image_embeddings (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('product', 'product_photo', 'collection_photo')),
  source_id uuid not null,
  product_id uuid references public.products(id) on delete cascade,
  collection_id uuid references public.product_collections(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  -- Soorten van het product en de collectie, om op soort te filteren.
  category_ids uuid[] not null default '{}',
  image_url text not null,
  embedding vector(1024),
  model text not null,
  -- Beeld niet te lezen: geen vector, wordt overgeslagen.
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source, source_id)
);
create index if not exists product_image_embeddings_embedding_idx on public.product_image_embeddings using hnsw (embedding vector_cosine_ops);
create index if not exists product_image_embeddings_categories_idx on public.product_image_embeddings using gin (category_ids);
create index if not exists product_image_embeddings_collection_idx on public.product_image_embeddings(collection_id);
alter table public.product_image_embeddings enable row level security;
create policy product_image_embeddings_admin_all on public.product_image_embeddings for all using (is_admin_user()) with check (is_admin_user());
comment on table public.product_image_embeddings is 'Beeld-embeddings (voyage-multimodal-3.5, 1024) van catalogusbeelden, om herkende producten op projectfoto''s op beeld te zoeken.';
alter table public.product_image_embeddings add column if not exists thumb_url text;
comment on column public.product_image_embeddings.thumb_url is 'Verkleinde kopie (±400 px) voor het oordeel van Claude: scheelt tokens per kandidaat.';

-- 2. Per detectie: de vector van de uitsnede en waar de koppeling staat.
alter table public.project_photo_detections add column if not exists embedding vector(1024);
alter table public.project_photo_detections add column if not exists match_status text check (match_status in ('queued', 'submitted', 'done', 'failed', 'no_candidates'));
alter table public.project_photo_detections add column if not exists match_batch_id text;
alter table public.project_photo_detections add column if not exists match_error text;
create index if not exists project_photo_detections_match_status_idx on public.project_photo_detections(match_status);

-- 3. Kandidaten per detectie (de beste op beeld) en het oordeel van Claude.
--    status: candidate (gevonden), suggested (Claude kiest deze),
--    approved / rejected (admin).
create table if not exists public.project_photo_detection_matches (
  id uuid primary key default gen_random_uuid(),
  detection_id uuid not null references public.project_photo_detections(id) on delete cascade,
  rank smallint not null,
  collection_id uuid references public.product_collections(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  image_url text,
  similarity real,
  status text not null default 'candidate' check (status in ('candidate', 'suggested', 'approved', 'rejected')),
  -- Hoe ver de koppeling reikt: het product zelf, de collectie, of alleen het merk.
  level text check (level in ('product', 'collection', 'brand')),
  confidence text check (confidence in ('high', 'medium', 'low')),
  reason text,
  source text not null default 'ai',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists project_photo_detection_matches_detection_idx on public.project_photo_detection_matches(detection_id, rank);
create index if not exists project_photo_detection_matches_collection_idx on public.project_photo_detection_matches(collection_id);
alter table public.project_photo_detection_matches enable row level security;
create policy project_photo_detection_matches_admin_all on public.project_photo_detection_matches for all using (is_admin_user()) with check (is_admin_user());
comment on table public.project_photo_detection_matches is 'Kandidaten (op beeld gevonden) voor een herkend product en het voorstel van Claude; admins keuren goed of af.';

-- 4. Zoeken: de catalogusbeelden die het meest op de uitsnede lijken,
--    binnen de gegeven soorten, het beste beeld per product of collectie.
create or replace function public.match_product_images(
  query_embedding vector(1024),
  category_filter uuid[],
  match_count int default 30
)
returns table (
  product_id uuid,
  collection_id uuid,
  brand_id uuid,
  image_url text,
  similarity real
)
language sql stable
set search_path = public
as $$
  with nearest as (
    select e.product_id, e.collection_id, e.brand_id, coalesce(e.thumb_url, e.image_url) as image_url,
           (1 - (e.embedding <=> query_embedding))::real as similarity
    from public.product_image_embeddings e
    where e.embedding is not null and (category_filter is null or e.category_ids && category_filter)
    order by e.embedding <=> query_embedding
    limit greatest(match_count * 4, 100)
  ),
  best as (
    select distinct on (coalesce(n.product_id, n.collection_id)) n.*
    from nearest n
    order by coalesce(n.product_id, n.collection_id), n.similarity desc
  )
  select b.product_id, b.collection_id, b.brand_id, b.image_url, b.similarity
  from best b
  order by b.similarity desc
  limit match_count
$$;
comment on function public.match_product_images is 'Productherkenning: de catalogusbeelden die het meest op een uitsnede lijken (cosine), binnen de soorten, één per product of collectie.';
