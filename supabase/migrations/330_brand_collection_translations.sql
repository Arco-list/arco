-- Beschrijvingen van merken en collecties in het Engels en Nederlands,
-- zoals companies.translations. description blijft de Engelse brontekst;
-- de pijplijn vult beide talen, een admin-bewerking wordt op de
-- achtergrond vertaald (lib/collections/translate).
alter table public.brands add column if not exists translations jsonb not null default '{}'::jsonb;
alter table public.product_collections add column if not exists translations jsonb not null default '{}'::jsonb;
comment on column public.brands.translations is 'Per taal: { "en": { "description": … }, "nl": { "description": … } }, zoals companies.translations. description blijft de Engelse brontekst.';
comment on column public.product_collections.translations is 'Per taal: { "en": { "description": … }, "nl": { "description": … } }, zoals companies.translations.';
