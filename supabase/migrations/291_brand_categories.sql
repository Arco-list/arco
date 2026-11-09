-- 291_brand_categories.sql
--
-- Wat een merk maakt, zoals services_offered zegt wat een bedrijf doet.
-- Koppeltabel op product_categories (hoofd- én subcategorieën), met een
-- positie zodat de eerste de primaire is — dezelfde afspraak als
-- primary_service_id bij bedrijven, zonder er een tweede kolom voor te
-- hoeven dragen. Admin-only, net als brands en product_families.

CREATE TABLE public.brand_categories (
  brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, category_id)
);

CREATE INDEX brand_categories_category_idx ON public.brand_categories (category_id);

ALTER TABLE public.brand_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY brand_categories_admin_all ON public.brand_categories
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
