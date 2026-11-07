-- ═══════════════════════════════════════════════════════════════════════
-- 289: series op de merkkoppeling, en wat een seriepagina moet tonen
-- ═══════════════════════════════════════════════════════════════════════
-- De merkenlaag gaat niet naar producten maar naar SERIES: Occhio › Mito,
-- Drop › Spa, B&B Italia › Tobi-Ishi. Dat is hoe een merk zichzelf
-- verkoopt, hoe een architect specificeert, en wat op een foto te
-- herkennen is — een serie heeft een vorm, een artikelnummer niet.
--
-- product_families (129) ís die serietabel; alleen de naam zei het niet.
-- Hier krijgt de koppeling uit 288 een optionele serie: "Klafs" (serie
-- onbekend) of "Occhio › Mito" (serie bekend). Zelfde grof-naar-fijn:
-- merk → serie → foto.
--
-- Uniciteit per project × merk × serie. family_id is nullable en NULL
-- is in een unique index nooit gelijk aan NULL, dus via COALESCE naar
-- een vaste nil-uuid — anders kon "Klafs zonder serie" twee keer op een
-- project staan.

ALTER TABLE public.project_brands
  ADD COLUMN family_id uuid REFERENCES public.product_families(id) ON DELETE SET NULL;

CREATE INDEX project_brands_family_idx ON public.project_brands (family_id);

DROP INDEX IF EXISTS public.project_brands_coarse_unique;
DROP INDEX IF EXISTS public.project_brands_photo_unique;

CREATE UNIQUE INDEX project_brands_coarse_unique
  ON public.project_brands (
    project_id,
    brand_id,
    COALESCE(family_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE photo_id IS NULL;

CREATE UNIQUE INDEX project_brands_photo_unique
  ON public.project_brands (
    project_id,
    brand_id,
    COALESCE(family_id, '00000000-0000-0000-0000-000000000000'::uuid),
    photo_id
  )
  WHERE photo_id IS NOT NULL;

-- Wat een architect op een seriepagina leest en een catalogus niet
-- geeft: wie hem ontwierp en wanneer. Plus de pagina van de serie bij
-- het merk zelf, voor de doorverwijzing.
ALTER TABLE public.product_families
  ADD COLUMN designer text,
  ADD COLUMN launch_year integer,
  ADD COLUMN url text;
