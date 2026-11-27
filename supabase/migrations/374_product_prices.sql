-- Prijs per product, uitgelezen van de collectiepagina van het merk
-- (lib/collections/pipeline). Opgeslagen, nog nergens publiek getoond:
-- prijzen verschillen per land en uitvoering en verouderen.
--   price_type    fixed       een vaste prijs
--                 from        "vanaf" (kleinste maat, goedkoopste uitvoering)
--                 on_request  "prijs op aanvraag" (zegt ook iets: vooral bij
--                             de duurste merken); dan geen bedrag
--   price_amount  het bedrag zoals op de pagina (incl. btw als de pagina dat
--                 zo toont)
--   price_currency  ISO 4217 (EUR, GBP, USD, DKK…)
--   price_country   ISO 3166-1 alpha-2 als de pagina dat laat zien, anders null
--   price_source_url / price_observed_at  waar en wanneer gezien

alter table public.products
  add column if not exists price_type text check (price_type in ('fixed', 'from', 'on_request')),
  add column if not exists price_amount numeric(12, 2) check (price_amount is null or price_amount > 0),
  add column if not exists price_currency text check (price_currency is null or price_currency ~ '^[A-Z]{3}$'),
  add column if not exists price_country text check (price_country is null or price_country ~ '^[A-Z]{2}$'),
  add column if not exists price_source_url text,
  add column if not exists price_observed_at timestamptz;

comment on column public.products.price_type is 'fixed | from | on_request; null = geen prijs gezien.';
comment on column public.products.price_amount is 'Bedrag zoals op de merkpagina; null bij on_request.';
comment on column public.products.price_currency is 'ISO 4217-valuta van price_amount.';
comment on column public.products.price_country is 'Land waarvoor de prijs geldt (ISO 3166-1 alpha-2), als de pagina dat toont.';
comment on column public.products.price_source_url is 'De pagina waarop de prijs stond.';
comment on column public.products.price_observed_at is 'Wanneer de prijs is uitgelezen.';
