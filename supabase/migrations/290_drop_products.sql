-- 290_drop_products.sql
--
-- De productlaag gaat eruit. De merkenlaag loopt merk → serie → foto
-- (project_brands, migraties 288/289); losse producten met varianten,
-- specs en eigen foto's horen daar niet meer in. product_families blijft
-- als serietabel; product_categories, retailers en brand_retailers
-- blijven staan voor later.
--
-- Met de hand gedraaid in de SQL-editor op 2026-11-07 — de MCP-weg
-- weigert DROP. Dit bestand is het verslag; IF EXISTS maakt hem
-- herhaalbaar. Eén los object onder company-assets/products/ in storage
-- is niet opgeruimd; dat is geen tabel.

DROP TABLE IF EXISTS public.project_products;
DROP TABLE IF EXISTS public.saved_products;
DROP TABLE IF EXISTS public.product_photos;
DROP TABLE IF EXISTS public.products;
DROP TYPE IF EXISTS public.product_status;
