-- De "je project staat live"-mail wacht op de beoordeling van de stippen.
--
-- Goedkeuren zet een project meteen live; de herkenning draait daarna
-- (batch) en een admin ruimt de stippen op. Pas als er niets meer open
-- staat gaat de mail de deur uit, zodat de eigenaar alleen de goede stippen
-- ziet. Gezet bij goedkeuren, leeg zodra de mail verstuurd is
-- (lib/projects/live-email.ts, de cron van photo-detections).

alter table public.projects
  add column if not exists live_email_held_at timestamptz;

comment on column public.projects.live_email_held_at is
  'Sinds wanneer de project-live-mail wacht tot de stippen beoordeeld zijn; null = niets in de wacht.';

create index if not exists projects_live_email_held_idx
  on public.projects (live_email_held_at) where live_email_held_at is not null;
