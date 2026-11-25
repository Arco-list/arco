-- /admin/projects: de kolom Producten — per project de stippen van de
-- productherkenning en hoe ver de beoordeling is. Een view met tellingen,
-- zodat de lijst niet alle detecties hoeft op te halen. security_invoker: de
-- RLS van de tabellen eronder (alleen admins) geldt ook hier.

create or replace view public.project_detection_counts
with (security_invoker = true) as
select
  p.project_id,
  -- Stippen die meetellen (verborgen niet).
  count(d.id) filter (where d.review_status is distinct from 'hidden') as dots,
  count(d.id) filter (where d.review_status = 'approved') as linked,
  -- Klaar om te beoordelen: gekoppeld (of geen kandidaten), nog geen oordeel.
  count(d.id) filter (where d.review_status is null and d.match_status in ('done', 'no_candidates', 'failed')) as open,
  count(d.id) filter (where d.review_status = 'missing') as waiting,
  count(d.id) filter (where d.review_status = 'unknown') as unknown,
  -- Nog bezig: foto's in de wachtrij of bij Claude, of stippen die nog gekoppeld worden.
  (count(*) filter (where p.status in ('queued', 'submitted')) > 0
    or count(d.id) filter (where d.review_status is null and (d.match_status is null or d.match_status = 'submitted')) > 0) as busy
from public.project_photo_analyses p
left join public.project_photo_detections d on d.photo_id = p.photo_id
group by p.project_id;

comment on view public.project_detection_counts is 'Per project: stippen (zonder verborgen), gekoppeld, open, wachtend op de catalogus, onbekend, en of de herkenning nog bezig is. Voor de kolom Producten in /admin/projects.';
