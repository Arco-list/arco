-- 308: bedrijfsgegevens van een merk uit Apollo (account in de lijst "Brands"):
-- adres, telefoon, sociale kanalen, branchecodes en het Apollo-id waarmee een
-- volgende import hetzelfde bedrijf terugvindt. De categorie volgt uit de
-- branchecodes plus een voorstel van Claude en staat in brand_categories.
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS street_address text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS x_url text,
  ADD COLUMN IF NOT EXISTS naics_codes text[],
  ADD COLUMN IF NOT EXISTS sic_codes text[],
  ADD COLUMN IF NOT EXISTS apollo_account_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_apollo_account ON public.brands(apollo_account_id) WHERE apollo_account_id IS NOT NULL;
