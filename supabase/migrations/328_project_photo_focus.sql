-- Focuspunt van een projectfoto: de hero snijdt bij rond dit punt
-- (lib/images/focus); op project edit te zetten met een klik op de hero.
alter table public.project_photos
  add column if not exists focus_x real check (focus_x between 0 and 1),
  add column if not exists focus_y real check (focus_y between 0 and 1);
comment on column public.project_photos.focus_x is 'Focuspunt voor de hero (0 = links, 1 = rechts): wat in beeld blijft bij bijsnijden.';
comment on column public.project_photos.focus_y is 'Focuspunt voor de hero (0 = boven, 1 = onder).';
