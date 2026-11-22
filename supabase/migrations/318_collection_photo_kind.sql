-- 318: soort per collectiefoto.
--
-- ambiance: het product in een omgeving (sfeerbeeld) — wat de galerij op
--           de collectiepagina toont en waar de hoofdfoto uit komt.
-- product:  vrijstaand op wit of doorzichtig (studiobeeld) — hoort bij
--           Producten, niet in de galerij.
-- detail:   materiaal, staal, close-up.
-- NULL:     nog niet ingedeeld; de pagina's behandelen dat als vroeger.
-- Ingedeeld door Claude (eenmalig, en daarna bij elke upload), met de
-- hand aan te passen op de bewerkpagina van een collectie.
ALTER TABLE public.product_collection_photos
  ADD COLUMN IF NOT EXISTS kind text CHECK (kind IN ('ambiance', 'product', 'detail'));
