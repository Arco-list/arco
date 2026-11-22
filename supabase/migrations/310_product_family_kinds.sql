-- 310_product_family_kinds.sql
--
-- De productsoorten van een serie: Nagomi is een fauteuil, een bank, een
-- ligbed én een eettafel. product_families.category_id (295) blijft de
-- ene soort of groep waaronder de serie in het Producten-menu hangt;
-- hier staan de soorten die de serie zelf maakt, zoals brand_categories
-- doet voor merken. position zet de belangrijkste vooraan.

CREATE TABLE public.product_family_kinds (
  family_id   uuid NOT NULL REFERENCES public.product_families(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, category_id)
);

CREATE INDEX product_family_kinds_category_idx ON public.product_family_kinds (category_id);

ALTER TABLE public.product_family_kinds ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_family_kinds_admin_all ON public.product_family_kinds
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
