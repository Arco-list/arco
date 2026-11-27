-- Automatisch verbergen per soort (migratie 342), nu met de reden van
-- verwijderen (migratie 348): alleen redenen die over de soort gaan tellen
-- (maatwerk, voeren we niet, anders, of geen reden). "Te klein", "dubbel" en
-- "verkeerd kader" zeggen iets over die ene stip, niet over de soort: die
-- tellen helemaal niet mee, ook niet als oordeel.

create or replace view public.detection_kind_review_stats
with (security_invoker = true) as
select
  kind_slug,
  count(*) filter (
    where review_status is not null and reviewed_by is not null
      and coalesce(hidden_reason, '') not in ('not_prominent', 'duplicate', 'wrong_box')
  ) as reviewed,
  count(*) filter (
    where review_status = 'hidden' and reviewed_by is not null
      and coalesce(hidden_reason, '') not in ('not_prominent', 'duplicate', 'wrong_box')
  ) as hidden
from public.project_photo_detections
where kind_slug is not null and source = 'ai'
group by kind_slug;

comment on view public.detection_kind_review_stats is 'Per soort: oordelen van admins en hoeveel daarvan verwijderen, zonder verwijderingen om een reden die alleen die stip betreft (te klein, dubbel, verkeerd kader). Basis voor het automatisch verbergen van soorten.';
