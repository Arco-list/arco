-- Douchewanden uit de indeling (geparkeerd, niet verwijderd): maatwerk, gaat
-- via professionals. Van de drie stippen waren er twee al verwijderd; de open
-- stip gaat mee, met de reden "voeren we niet". Geen producten of collecties.
update public.product_categories set is_active = false where slug = 'shower-enclosures';

update public.project_photo_detections d
set review_status = 'hidden', hidden_reason = 'not_carried'
where d.category_id = (select id from public.product_categories where slug = 'shower-enclosures')
  and d.review_status is null
  and not exists (select 1 from public.project_detection_links l where l.detection_id = d.id);
