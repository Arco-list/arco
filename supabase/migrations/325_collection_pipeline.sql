-- Collecties van een merk in twee stappen, op de achtergrond (lib/collections):
--
--   1. Inventariseren: de site in kaart, de overzichtspagina's gelezen; wat
--      gevonden wordt komt als KANDIDAAT in brand_collection_candidates
--      (naam, link, één foto, categorie), nog niet als collectie.
--   2. Na de keuze in /admin/brands worden de gekozen kandidaten collecties
--      en haalt een tweede taak omschrijving, ontwerper, jaar, soorten,
--      producten en sfeerbeelden op.
--
-- Claude draait via de batch-API (half geld, verwerking binnen een uur);
-- een cron (/api/cron/collection-pipeline) zet elke taak een stap verder.
-- Alleen de service-rol leest en schrijft: RLS aan, geen policies.

create table if not exists brand_collection_jobs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  kind text not null check (kind in ('inventory', 'enrich')),
  -- inventory: queued → picking_pages → fetching_pages → reading_pages → storing_images → done
  -- enrich:    queued → working → done
  stage text not null default 'queued',
  progress_done integer not null default 0,
  progress_total integer not null default 0,
  -- Werkgeheugen van de taak: open batches, te lezen pagina's, per collectie de stap.
  state jsonb not null default '{}'::jsonb,
  error text,
  firecrawl_credits integer not null default 0,
  -- Een cronronde claimt een taak tot dit tijdstip, zodat twee rondes
  -- (elke minuut, soms langer bezig) niet tegelijk aan dezelfde taak werken.
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists brand_collection_jobs_active_idx on brand_collection_jobs (updated_at) where stage not in ('done', 'error');
create index if not exists brand_collection_jobs_brand_idx on brand_collection_jobs (brand_id, created_at desc);
alter table brand_collection_jobs enable row level security;

create table if not exists brand_collection_candidates (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  slug text not null,
  url text,
  source_page_url text,
  description text,
  category_id uuid references product_categories(id) on delete set null,
  -- Onze kopie van het overzichtsbeeld, en waar het vandaan kwam. Ook voor
  -- kandidaten die niet gekozen worden: referentiebeeld voor productherkenning.
  image_url text,
  source_image_url text,
  status text not null default 'found' check (status in ('found', 'chosen')),
  collection_id uuid references product_collections(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (brand_id, slug)
);
create index if not exists brand_collection_candidates_brand_idx on brand_collection_candidates (brand_id, status);
alter table brand_collection_candidates enable row level security;
