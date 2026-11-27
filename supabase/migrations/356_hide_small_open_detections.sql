-- Prominentie met terugwerkende kracht: open (nog niet beoordeelde) AI-stippen
-- waarvan het kader kleiner is dan de nieuwe drempel (MIN_BOX_SIDE 10% of
-- MIN_BOX_AREA 1% van de foto, lib/recognition/photo-detections.ts) worden
-- verborgen met de reden "niet prominent". Beoordeelde en gekoppelde stippen
-- blijven staan. De reden telt niet mee in de soortstatistiek (migratie 349).
update public.project_photo_detections d
set review_status = 'hidden', hidden_reason = 'not_prominent'
where d.source = 'ai'
  and d.review_status is null
  and d.box_x0 is not null
  and (greatest(abs(d.box_x1 - d.box_x0), abs(d.box_y1 - d.box_y0)) < 0.1
       or abs(d.box_x1 - d.box_x0) * abs(d.box_y1 - d.box_y0) < 0.01)
  and not exists (select 1 from public.project_detection_links l where l.detection_id = d.id);
