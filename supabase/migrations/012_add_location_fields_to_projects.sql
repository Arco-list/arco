-- Migration: Add structured location data to projects
-- Description: Stores full address details, coordinates, and privacy toggle.

ALTER TABLE public.projects
  ADD COLUMN address_street text,
  ADD COLUMN address_city text,
  ADD COLUMN address_region text,
  ADD COLUMN address_postal_code text,
  ADD COLUMN address_country text DEFAULT 'Netherlands',
  ADD COLUMN address_formatted text,
  ADD COLUMN latitude numeric(10, 7),
  ADD COLUMN longitude numeric(10, 7),
  ADD COLUMN share_exact_location boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.projects.address_formatted IS 'Full formatted address returned by Places autocomplete';
COMMENT ON COLUMN public.projects.share_exact_location IS 'If false, only city/region should be surfaced publicly';

-- Optional spatial index for map queries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_projects_location'
  ) THEN
    CREATE INDEX idx_projects_location ON public.projects USING gist (point(longitude, latitude));
  END IF;
END $$;
