-- 317: merk-stippen op projectfoto's.
--
-- Een stip op een foto (x, y als fractie van de breedte en hoogte, 0–1)
-- wijst een merk aan, en waar bekend de collectie. Op de projectpagina
-- staat de stip in de lightbox; een klik toont een kaart zoals op de
-- professionalskaart. Zolang de merkenlaag admin-only is, linkt de kaart
-- voor bezoekers naar de site van het merk (de collectiepagina daar, of
-- de homepage) en voor admins naar de merk- of collectiepagina op Arco.
--
-- Publiek leesbaar (het zijn feiten over een gepubliceerde foto);
-- schrijven alleen via de service role.
CREATE TABLE IF NOT EXISTS public.project_photo_brand_tags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id      uuid NOT NULL REFERENCES public.project_photos(id) ON DELETE CASCADE,
  brand_id      uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES public.product_collections(id) ON DELETE SET NULL,
  x             real NOT NULL CHECK (x >= 0 AND x <= 1),
  y             real NOT NULL CHECK (y >= 0 AND y <= 1),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_photo_brand_tags_photo ON public.project_photo_brand_tags(photo_id);

ALTER TABLE public.project_photo_brand_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS photo_brand_tags_read ON public.project_photo_brand_tags;
CREATE POLICY photo_brand_tags_read ON public.project_photo_brand_tags FOR SELECT USING (true);

-- Eerste stip: de DEDON MBARQ-bank op de terrasfoto van "Landelijke tuin
-- in Reeuwijk" (Ernst Baas Hoveniers), midden op de zitting.
INSERT INTO public.project_photo_brand_tags (photo_id, brand_id, collection_id, x, y)
SELECT '4531e3cb-0bb5-4e7b-8030-0ac4565ed5fa', b.id, c.id, 0.37, 0.56
FROM public.brands b
JOIN public.product_collections c ON c.brand_id = b.id AND c.slug = 'mbarq'
WHERE b.slug = 'dedon'
  AND NOT EXISTS (SELECT 1 FROM public.project_photo_brand_tags t WHERE t.photo_id = '4531e3cb-0bb5-4e7b-8030-0ac4565ed5fa');
