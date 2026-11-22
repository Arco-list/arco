-- 311_rename_families_to_collections.sql
--
-- "Series" heet voortaan "collecties" (zo noemen de merken ze zelf, en
-- zo zoeken architecten ze). Zelfde rijen, nieuwe namen: tabellen,
-- kolommen, constraints, indexen, policies en de trigger. Een rename
-- neemt foreign keys en indexen mee; de namen zetten we hier gelijk, zodat
-- de database niet half over "families" en half over "collections" praat.
-- Geen data verandert. Alleen de admin-lagen (merken, producten, de
-- merkkiezer op de projectpagina) lezen deze tabellen.

ALTER TABLE public.product_families       RENAME TO product_collections;
ALTER TABLE public.product_family_photos  RENAME TO product_collection_photos;
ALTER TABLE public.product_family_kinds   RENAME TO product_collection_kinds;

ALTER TABLE public.product_collection_photos RENAME COLUMN family_id TO collection_id;
ALTER TABLE public.product_collection_kinds  RENAME COLUMN family_id TO collection_id;
ALTER TABLE public.project_brands            RENAME COLUMN family_id TO collection_id;

-- Constraints (hun indexen — pkey en unique — gaan mee).
ALTER TABLE public.product_collections RENAME CONSTRAINT product_families_brand_id_fkey     TO product_collections_brand_id_fkey;
ALTER TABLE public.product_collections RENAME CONSTRAINT product_families_brand_id_slug_key TO product_collections_brand_id_slug_key;
ALTER TABLE public.product_collections RENAME CONSTRAINT product_families_category_id_fkey  TO product_collections_category_id_fkey;
ALTER TABLE public.product_collections RENAME CONSTRAINT product_families_pkey              TO product_collections_pkey;

ALTER TABLE public.product_collection_kinds RENAME CONSTRAINT product_family_kinds_category_id_fkey TO product_collection_kinds_category_id_fkey;
ALTER TABLE public.product_collection_kinds RENAME CONSTRAINT product_family_kinds_family_id_fkey   TO product_collection_kinds_collection_id_fkey;
ALTER TABLE public.product_collection_kinds RENAME CONSTRAINT product_family_kinds_pkey             TO product_collection_kinds_pkey;

ALTER TABLE public.product_collection_photos RENAME CONSTRAINT product_family_photos_family_id_fkey TO product_collection_photos_collection_id_fkey;
ALTER TABLE public.product_collection_photos RENAME CONSTRAINT product_family_photos_pkey           TO product_collection_photos_pkey;

ALTER TABLE public.project_brands RENAME CONSTRAINT project_brands_family_id_fkey TO project_brands_collection_id_fkey;

-- Losse indexen.
ALTER INDEX public.idx_product_families_brand_id        RENAME TO idx_product_collections_brand_id;
ALTER INDEX public.product_families_category_idx        RENAME TO product_collections_category_idx;
ALTER INDEX public.product_family_kinds_category_idx    RENAME TO product_collection_kinds_category_idx;
ALTER INDEX public.product_family_photos_family_idx    RENAME TO product_collection_photos_collection_idx;
ALTER INDEX public.product_family_photos_source_idx    RENAME TO product_collection_photos_source_idx;
ALTER INDEX public.project_brands_family_idx            RENAME TO project_brands_collection_idx;

-- Policies en trigger.
ALTER POLICY product_families_admin_all      ON public.product_collections       RENAME TO product_collections_admin_all;
ALTER POLICY product_family_kinds_admin_all  ON public.product_collection_kinds  RENAME TO product_collection_kinds_admin_all;
ALTER POLICY product_family_photos_admin_all ON public.product_collection_photos RENAME TO product_collection_photos_admin_all;

ALTER TRIGGER product_families_set_updated_at ON public.product_collections RENAME TO product_collections_set_updated_at;
