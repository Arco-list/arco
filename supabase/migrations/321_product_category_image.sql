-- 321: eigen beeld per productcategorie voor de schijven bovenaan /products.
-- Leeg: de productfoto van de meest toegepaste collectie in de groep; geen
-- collecties: het lijnicoon van de groep.

alter table product_categories add column if not exists image_url text;
