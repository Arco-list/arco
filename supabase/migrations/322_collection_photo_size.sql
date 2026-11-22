-- 322: maten van collectiefoto's, zodat de hero van een collectie een
-- liggende foto kan kiezen (lib/products/collection-hero). Gevuld bij het
-- toevoegen (measureCollectionPhotos); bestaande foto's eenmalig met een
-- script.

alter table product_collection_photos add column if not exists width integer;
alter table product_collection_photos add column if not exists height integer;
