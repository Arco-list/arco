-- 304: marktomvang per dienst.
-- TAM NL: aantal bedrijven in Nederland in deze dienst.
-- SAM NL: hoeveel daarvan geschikt zijn voor Arco.
-- Handmatig ingevuld in het bewerkvenster op /admin/categories (Professionals).
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS tam_nl integer CHECK (tam_nl IS NULL OR tam_nl >= 0),
  ADD COLUMN IF NOT EXISTS sam_nl integer CHECK (sam_nl IS NULL OR sam_nl >= 0);
COMMENT ON COLUMN public.categories.tam_nl IS 'Total addressable market NL: aantal bedrijven in Nederland in deze dienst.';
COMMENT ON COLUMN public.categories.sam_nl IS 'Serviceable addressable market NL: aantal bedrijven dat geschikt is voor Arco.';
