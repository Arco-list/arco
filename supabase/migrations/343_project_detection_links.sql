-- Goedgekeurde productherkenning als koppeling tussen project en merk /
-- collectie, net als project_brands en project_photo_brand_tags: de merk- en
-- collectiepagina's ("In projecten") en de tellers lezen alle drie
-- (lib/products/catalog.ts). Op merkniveau goedgekeurd: geen collectie.
-- Een teruggedraaide goedkeuring valt er vanzelf uit.

create or replace view public.project_detection_links
with (security_invoker = true) as
select
  d.id as detection_id,
  d.project_id,
  d.photo_id,
  m.brand_id,
  case when m.level = 'brand' then null else m.collection_id end as collection_id,
  coalesce(m.reviewed_at, d.reviewed_at, d.created_at) as created_at
from public.project_photo_detections d
join public.project_photo_detection_matches m on m.detection_id = d.id and m.status = 'approved'
where d.review_status = 'approved';

comment on view public.project_detection_links is 'Goedgekeurde stippen van de productherkenning als koppeling project ↔ merk/collectie (met de foto), naast project_brands en project_photo_brand_tags.';
