-- 292_product_family_photos.sql
--
-- Foto's van een serie, zoals een product ze had: meerdere beelden, één
-- primair. hero_image_url op product_families blijft bestaan als de kopie
-- van de primaire foto — dat is wat de kaarten lezen zonder join; de
-- acties houden hem bij. Bestaande covers worden de eerste foto.

CREATE TABLE public.product_family_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   uuid NOT NULL REFERENCES public.product_families(id) ON DELETE CASCADE,
  url         text NOT NULL,
  alt_text    text,
  is_primary  boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_family_photos_family_idx ON public.product_family_photos (family_id, order_index);

ALTER TABLE public.product_family_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_family_photos_admin_all ON public.product_family_photos
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

INSERT INTO public.product_family_photos (family_id, url, is_primary, order_index)
SELECT id, hero_image_url, true, 0
FROM public.product_families
WHERE hero_image_url IS NOT NULL;
