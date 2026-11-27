-- Productherkenning: waarom een admin een stip verwijdert (verbergt). Eén
-- vaste reden, zodat te tellen is wat de herkenning fout doet en de prompt
-- en drempels gericht aangescherpt kunnen worden (te meten met
-- scripts/eval-recognition.ts). Alleen admins kiezen een reden; leeg mag.

alter table public.project_photo_detections
  add column if not exists hidden_reason text;

alter table public.project_photo_detections drop constraint if exists project_photo_detections_hidden_reason_check;
alter table public.project_photo_detections add constraint project_photo_detections_hidden_reason_check
  check (hidden_reason in ('not_prominent', 'bespoke', 'not_carried', 'duplicate', 'wrong_box', 'other'));

comment on column public.project_photo_detections.hidden_reason is
  'Waarom verwijderd (review_status hidden), door een admin: not_prominent (te klein/ver weg), bespoke (maatwerk/vast), not_carried (geen product dat Arco voert), duplicate (dubbel op de foto), wrong_box (verkeerd kader/plek), other. Null: geen reden gegeven.';
