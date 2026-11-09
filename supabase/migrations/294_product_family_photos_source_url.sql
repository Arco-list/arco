-- 294_product_family_photos_source_url.sql
--
-- Foto's van series worden gekopieerd naar de eigen bucket in plaats van
-- gelinkt. `url` is dan de onze; `source_url` onthoudt waar hij vandaan
-- kwam, zodat een tweede scrape van dezelfde pagina zijn eigen foto's
-- herkent en niet opnieuw ophaalt. Null voor geüploade foto's.

ALTER TABLE public.product_family_photos ADD COLUMN source_url text;
CREATE INDEX product_family_photos_source_idx ON public.product_family_photos (family_id, source_url);
