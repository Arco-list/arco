-- Plantenbakken uit de indeling (geparkeerd, niet verwijderd). Van de tien
-- stippen waren er al negen verwijderd; de laatste open stip gaat mee, met de
-- reden "voeren we niet". Het ene product houdt zijn categorie, net als bij
-- Afwerking: geparkeerd, dus nergens zichtbaar.
update public.product_categories set is_active = false where slug = 'planters';

update public.project_photo_detections d
set review_status = 'hidden', hidden_reason = 'not_carried'
where d.category_id = (select id from public.product_categories where slug = 'planters')
  and d.review_status is null
  and not exists (select 1 from public.project_detection_links l where l.detection_id = d.id);
