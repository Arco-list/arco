-- /admin/projects, kolom Producten: hoeveel van de stippen beoordeeld is,
-- voor het percentage voltooid achter "gekoppeld / stippen". Zelfde view als
-- migratie 341, met een kolom erbij (achteraan, zodat create or replace kan).

create or replace view public.project_detection_counts
with (security_invoker = true) as
select
  p.project_id,
  count(d.id) filter (where d.review_status is distinct from 'hidden') as dots,
  count(d.id) filter (where d.review_status = 'approved') as linked,
  count(d.id) filter (where d.review_status is null and d.match_status in ('done', 'no_candidates', 'failed')) as open,
  count(d.id) filter (where d.review_status = 'missing') as waiting,
  count(d.id) filter (where d.review_status = 'unknown') as unknown,
  (count(*) filter (where p.status in ('queued', 'submitted')) > 0
    or count(d.id) filter (where d.review_status is null and (d.match_status is null or d.match_status = 'submitted')) > 0) as busy,
  -- Beoordeeld, van de stippen die meetellen (verborgen niet).
  count(d.id) filter (where d.review_status is not null and d.review_status <> 'hidden') as reviewed
from public.project_photo_analyses p
left join public.project_photo_detections d on d.photo_id = p.photo_id
group by p.project_id;

comment on view public.project_detection_counts is 'Per project: stippen (zonder verborgen), gekoppeld, open, wachtend op de catalogus, onbekend, of de herkenning nog bezig is, en hoeveel stippen beoordeeld zijn. Voor de kolom Producten in /admin/projects.';
