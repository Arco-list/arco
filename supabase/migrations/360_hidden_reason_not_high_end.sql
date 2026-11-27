-- Reden van verwijderen: "Geen high-end merk" erbij (not_high_end). In de
-- kiezer staan voortaan Niet prominent, Maatwerk, Dubbel, Geen high-end merk
-- en Anders; not_carried en wrong_box blijven geldig voor bestaande stippen
-- (en not_carried voor het parkeren van categorieën, 351/357/358).
alter table public.project_photo_detections drop constraint if exists project_photo_detections_hidden_reason_check;
alter table public.project_photo_detections add constraint project_photo_detections_hidden_reason_check
  check (hidden_reason in ('not_prominent', 'bespoke', 'not_carried', 'duplicate', 'wrong_box', 'not_high_end', 'other'));

-- "Geen high-end merk" zegt iets over het merk van die ene stip, niet over de
-- soort: telt, net als te klein, dubbel en verkeerd kader, niet mee voor het
-- automatisch verbergen van een soort.
create or replace view public.detection_kind_review_stats
with (security_invoker = true) as
select
  kind_slug,
  count(*) filter (
    where review_status is not null and reviewed_by is not null
      and coalesce(hidden_reason, '') not in ('not_prominent', 'duplicate', 'wrong_box', 'not_high_end')
  ) as reviewed,
  count(*) filter (
    where review_status = 'hidden' and reviewed_by is not null
      and coalesce(hidden_reason, '') not in ('not_prominent', 'duplicate', 'wrong_box', 'not_high_end')
  ) as hidden
from public.project_photo_detections
where kind_slug is not null and source = 'ai'
group by kind_slug;
