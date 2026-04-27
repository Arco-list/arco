-- Companies inherit `audience` from their service categories.
--
-- A company is `audience = 'pro'` iff any of its services (services_offered
-- or primary_service_id) maps to a category with audience = 'pro'. Otherwise
-- 'homeowner' (the default).
--
-- This is the "lock": there is no manual override on companies — audience is
-- always derived from services, so a photographer company can never
-- accidentally surface in homeowner discovery, and a homeowner-facing company
-- that adds Photographer as a service immediately becomes pro-only. The UI
-- should still prevent service swaps in the photographer claim flow for UX
-- reasons, but the DB stays consistent regardless.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'homeowner'
  CHECK (audience IN ('homeowner', 'pro'));

COMMENT ON COLUMN public.companies.audience IS
  'Derived from service categories. ''pro'' iff any service has audience=''pro'' (e.g. Photographer). Maintained by the trg_companies_sync_audience trigger — do not set manually.';

CREATE OR REPLACE FUNCTION public.companies_compute_audience(
  p_services_offered text[],
  p_primary_service_id uuid
) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.categories cat
      WHERE cat.audience = 'pro'
        AND (
          cat.id::text = ANY(COALESCE(p_services_offered, ARRAY[]::text[]))
          OR cat.id = p_primary_service_id
        )
    ) THEN 'pro'
    ELSE 'homeowner'
  END;
$$;

CREATE OR REPLACE FUNCTION public.companies_sync_audience()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.audience := public.companies_compute_audience(
    NEW.services_offered,
    NEW.primary_service_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_sync_audience ON public.companies;
CREATE TRIGGER trg_companies_sync_audience
  BEFORE INSERT OR UPDATE OF services_offered, primary_service_id
  ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.companies_sync_audience();

-- Backfill: set audience for any existing rows that already have a pro-audience
-- service (none expected today, but covers the case where a photographer
-- company was inserted between migrations 145 and 147).
UPDATE public.companies
SET audience = public.companies_compute_audience(services_offered, primary_service_id)
WHERE audience IS DISTINCT FROM
      public.companies_compute_audience(services_offered, primary_service_id);

CREATE INDEX IF NOT EXISTS idx_companies_audience ON public.companies(audience);
