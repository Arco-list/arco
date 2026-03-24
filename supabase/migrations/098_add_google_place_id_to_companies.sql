-- Add google_place_id to companies for deduplication of Google Places results
ALTER TABLE public.companies ADD COLUMN google_place_id TEXT UNIQUE;

CREATE INDEX idx_companies_google_place_id ON public.companies (google_place_id) WHERE google_place_id IS NOT NULL;
