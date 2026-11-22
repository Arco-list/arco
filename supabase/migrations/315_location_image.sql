-- 315: een foto per showroom (locations.image_url). Bedrijven uploaden
-- hem zelf; de showroomkaart op de bedrijfs- en merkpagina toont hem in
-- het formaat van een professionalkaart. Geen Google Maps-foto's: die
-- mogen niet worden opgeslagen.
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS image_url text;
