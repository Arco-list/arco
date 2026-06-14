-- Add companies.source — immutable record of how the company entered our system.
--
-- Distinct from companies.first_touch_source (how the company first engaged
-- with us). Backfilled from existing signals; intended to be set at insert
-- time going forward by each insert path (Apollo importer, signup flow,
-- admin "Add company", invite flow).

CREATE TYPE public.company_source AS ENUM ('apollo', 'direct', 'manual', 'invited');

ALTER TABLE public.companies
  ADD COLUMN source public.company_source;

-- Backfill, most-specific signal first. Photographer category is treated as
-- "invited" — a photographer placing the company on the platform is
-- functionally an invite, even though no email fires.
UPDATE public.companies c
SET source = 'invited'
FROM public.categories cat
WHERE c.primary_service_id = cat.id
  AND cat.slug = 'photographer'
  AND c.source IS NULL;

-- Apollo: the *acquisition* channel, not "has Apollo data". A row that was
-- bulk-imported but never engaged stays at the catch-all `manual`. Only
-- companies whose owner signed up *because* of an Apollo email belong here.
-- That signal isn't recoverable in SQL, so this rule errs on the side of
-- under-classifying — review post-backfill and bump specific rows to
-- `apollo` manually.
UPDATE public.companies
SET source = 'apollo'
WHERE apollo_account_id IS NOT NULL
  AND owner_id IS NOT NULL
  AND source IS NULL;

-- Project-invite classification (companies auto-created when a project owner
-- invited an unknown professional by email) is intentionally NOT automated.
-- The signal (presence of project_professionals.invited_email) over-fired
-- during initial backfill — many companies happen to have project links but
-- weren't acquired via invite. Classify these manually after the migration.

UPDATE public.companies
SET source = 'direct'
WHERE owner_id IS NOT NULL
  AND source IS NULL;

UPDATE public.companies
SET source = 'manual'
WHERE source IS NULL;

ALTER TABLE public.companies
  ALTER COLUMN source SET NOT NULL,
  ALTER COLUMN source SET DEFAULT 'manual';

CREATE INDEX companies_source_idx ON public.companies (source);
