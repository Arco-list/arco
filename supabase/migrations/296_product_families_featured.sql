-- 296_product_families_featured.sql
--
-- "Uitgelicht" op de productdiscover: met de hand gekozen series, op de
-- serie-adminpagina aan te vinken. Zonder keuze valt de pagina terug op
-- de series met de meeste projecten, zodat het vak nooit leeg is.

ALTER TABLE public.product_families ADD COLUMN is_featured boolean NOT NULL DEFAULT false;
