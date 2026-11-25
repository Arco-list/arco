-- Productherkenning leert van verwijderen: per soort hoe vaak een admin de
-- stip beoordeelde en hoe vaak verwijderde (verborg). Een soort die bijna
-- altijd verwijderd wordt (lib/recognition/photo-detections.ts: minstens 8
-- oordelen, 90%+ verborgen), wordt bij nieuwe foto's meteen verborgen en niet
-- gekoppeld. Alleen oordelen van een admin tellen (reviewed_by), niet de
-- automatisch verborgen stippen, zodat de regel zichzelf niet versterkt; een
-- paar keer goedkeuren zet de soort weer aan.

create or replace view public.detection_kind_review_stats
with (security_invoker = true) as
select
  kind_slug,
  count(*) filter (where review_status is not null and reviewed_by is not null) as reviewed,
  count(*) filter (where review_status = 'hidden' and reviewed_by is not null) as hidden
from public.project_photo_detections
where kind_slug is not null and source = 'ai'
group by kind_slug;

comment on view public.detection_kind_review_stats is 'Per soort: oordelen van admins en hoeveel daarvan verwijderen (verbergen). Basis voor het automatisch verbergen van soorten die bijna altijd verwijderd worden.';
