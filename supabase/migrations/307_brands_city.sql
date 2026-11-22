-- 307: vestigingsplaats van een merk (hoofdkantoor), uit Apollo.
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS city text;
COMMENT ON COLUMN public.brands.city IS 'Vestigingsplaats van het hoofdkantoor, uit Apollo.';
