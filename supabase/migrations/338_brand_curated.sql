-- Merken: de selectie (de ster in /admin/brands). Arco labelt alleen
-- high-end producten; een merk zonder ster doet niet mee:
--   - niet te kiezen bij "Merk toevoegen" in een project;
--   - geen kandidaat bij het koppelen van herkende producten;
--   - geen automatische inventarisatie als Claude het herkent.
-- Opt-out: elk merk staat er standaard in; een admin haalt de ster weg.

alter table public.brands add column if not exists is_curated boolean not null default true;
create index if not exists brands_is_curated_idx on public.brands(is_curated);
comment on column public.brands.is_curated is 'In de selectie (ster in /admin/brands): mag aan projecten gekoppeld worden en doet mee bij productherkenning. Standaard aan (opt-out).';

-- Zoeken op beeld: alleen catalogusbeelden van merken in de selectie.
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
language plpgsql stable
set search_path = public
as $$
begin
  perform set_config('hnsw.iterative_scan', 'relaxed_order', true);
  perform set_config('hnsw.ef_search', '100', true);
  return query
  with nearest as materialized (
    select e.product_id, e.collection_id, e.brand_id, coalesce(e.thumb_url, e.image_url) as image_url,
           (1 - (e.embedding <=> query_embedding))::real as similarity
    from public.product_image_embeddings e
    where e.embedding is not null
      and (category_filter is null or e.category_ids && category_filter)
      and exists (select 1 from public.brands b where b.id = e.brand_id and b.is_curated)
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
  limit match_count;
end;
$$;
comment on function public.match_product_images is 'Productherkenning: de catalogusbeelden die het meest op een uitsnede lijken (cosine), binnen de soorten en de merken in de selectie, één per product of collectie. Iterative scan: het filter kost geen kandidaten.';
