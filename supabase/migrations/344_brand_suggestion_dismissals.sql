-- Voorgestelde merken (/admin/brands, filter "Suggested"): een merk dat bij
-- het beoordelen van een stip is voorgesteld maar nog niet in de database
-- staat (project_photo_detections.missing_brand zonder missing_brand_id).
-- Een admin voegt het toe of negeert het; genegeerde namen staan hier, op
-- de genormaliseerde naam (kleine letters, alleen a-z en 0-9, zoals
-- normBrand in lib/recognition/matching.ts). Alleen de service role leest
-- en schrijft (RLS aan, geen policies).

create table if not exists public.brand_suggestion_dismissals (
  name_key text primary key,
  name text not null,
  dismissed_by uuid references auth.users(id) on delete set null,
  dismissed_at timestamptz not null default now()
);

alter table public.brand_suggestion_dismissals enable row level security;

comment on table public.brand_suggestion_dismissals is 'Voorgestelde merken (uit de beoordeling van stippen) die een admin negeerde; sleutel is de genormaliseerde naam.';
