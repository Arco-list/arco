-- 312_products.sql
--
-- De producten van een collectie, zoals de collectiepagina van het merk ze
-- toont: Nagomi lounge chair, Nagomi bench. Voorlopig alleen wat die pagina
-- zelf geeft — naam, het adres van de productpagina bij het merk en het
-- beeld — de basis voor het productmodel dat later komt (afmetingen,
-- materialen, varianten, eigen foto's). Een eerdere producttabel is
-- verwijderd in 290; dit is een nieuwe, kleinere start. Admin-only, net
-- als brands en product_collections.

CREATE TABLE public.products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  collection_id    uuid NOT NULL REFERENCES public.product_collections(id) ON DELETE CASCADE,
  slug             text NOT NULL,
  name             text NOT NULL,
  url              text,
  image_url        text,
  source_image_url text,
  position         integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, slug)
);

CREATE INDEX products_brand_idx ON public.products (brand_id);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_admin_all ON public.products
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
