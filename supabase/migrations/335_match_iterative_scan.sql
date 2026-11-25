-- Productherkenning: zoeken op beeld met een soortfilter blijft goed bij een
-- grote catalogus.
--
-- De HNSW-index levert standaard de ±40 dichtstbijzijnde beelden
-- (hnsw.ef_search) en pas daarna valt het soortfilter. Is een soort een klein
-- deel van de catalogus, dan blijven er maar een paar kandidaten over (getest
-- met geforceerde index: 8 van de 75 bijzettafels). Met iterative scan
-- (pgvector 0.8) zoekt de index door tot er genoeg rijen door het filter
-- komen (getest: 75 van de 75; de functie geeft er 30).
--
-- Supabase staat `set hnsw.…` als functie-attribuut niet toe (permission
-- denied), daarom plpgsql met set_config voor de duur van de transactie.
-- relaxed_order: de volgorde is bij benadering; de functie sorteert zelf
-- opnieuw op gelijkenis.

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
  limit match_count;
end;
$$;
comment on function public.match_product_images is 'Productherkenning: de catalogusbeelden die het meest op een uitsnede lijken (cosine), binnen de soorten, één per product of collectie. Iterative scan: het soortfilter kost geen kandidaten.';
