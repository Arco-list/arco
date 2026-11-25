-- Collectiepijplijn: sites die uit losse producten bestaan (Flos: "2097/18",
-- "2097/30", "2097/18 E12"). Na het lezen van de pagina's groepeert Claude de
-- gevonden namen tot families; één kandidaat per familie ("2097"), met de
-- varianten als producten. Bij het kiezen worden die de producten van de
-- collectie (lib/collections/families.ts).

alter table public.brand_collection_candidates add column if not exists products jsonb not null default '[]'::jsonb;
comment on column public.brand_collection_candidates.products is 'De producten (varianten) van deze familie zoals gevonden: [{ name, url, image_url, source_image_url }]. Leeg als de site de collectie als geheel toont.';
