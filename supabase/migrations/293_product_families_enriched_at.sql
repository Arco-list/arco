-- 293_product_families_enriched_at.sql
--
-- Wanneer de eigen pagina van een serie bij het merk is gelezen (foto's,
-- designer, jaar, omschrijving). Add brand slaat series met een datum
-- over, zodat een tweede keer plakken verder gaat waar de vorige keer
-- het tijdbudget op was; de knop op de seriepagina negeert hem.

ALTER TABLE public.product_families ADD COLUMN enriched_at timestamptz;
