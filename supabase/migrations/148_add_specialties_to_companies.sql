-- Specialties on companies.
--
-- For photographers: Residential / Hospitality / Interior / Architectural /
-- Commercial. Stored as a text[] for v1 — allowed values are validated in
-- application code (lib/photographer-specialties.ts). Don't over-normalize
-- before we know if other categories want their own specialty taxonomies.
--
-- Empty array on every existing company is fine; the field is only surfaced
-- on photographer pages today.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS specialties text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.companies.specialties IS
  'Free-form specialty tags. Currently surfaced for photographers only (Residential / Hospitality / Interior / Architectural / Commercial). Allowed values enforced in app code.';
