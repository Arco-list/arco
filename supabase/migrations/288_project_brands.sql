-- ═══════════════════════════════════════════════════════════════════════
-- 288: project_brands — een merk op een project, vóór er een product is
-- ═══════════════════════════════════════════════════════════════════════
-- De merkenlaag begint niet bij catalogi (Flos, Minotti) maar bij merken
-- die in gerealiseerd werk zijn toegepast: Klafs in de wellness, Compass
-- in de tuin, Drop in de badkamer. Wie dat weet is de architect — en die
-- weet het op het niveau van het MERK en de RUIMTE, niet van het
-- productnummer en de foto.
--
-- project_products (129) vraagt een product én een foto. Dat is de fijne
-- koppeling, voor later. Dit is de grove: project ↔ merk, optioneel met
-- een ruimte als hint en een vrije notitie ("S1 sauna"). photo_id en de
-- pin zijn NULLABLE en bedoeld voor de volgende stap: zodra een mens
-- heeft gezegd dát Klafs in dit project zit en wáár, kan een vision-pass
-- voorstellen op welke foto — als rij met source 'ai' en status
-- 'pending', ter beoordeling. De ruimtehint maakt die zoektocht klein.
--
-- Twee uniciteitsregels: één grove koppeling per project×merk (zonder
-- foto), en één per project×merk×foto zodra er wel een foto is.
--
-- RLS: alleen admins, zoals de rest van de merkenlaag in fase 1. Een
-- publieke leesregel komt met de publieke merkpagina, niet eerder —
-- anders staat de tabel via PostgREST open terwijl niets hem toont.

CREATE TABLE public.project_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  -- Waar in het project zit het merk? Hint voor mens én vision-pass.
  space_id uuid REFERENCES public.spaces(id) ON DELETE SET NULL,
  -- Op welke foto? Leeg tot iemand of iets het aanwijst.
  photo_id uuid REFERENCES public.project_photos(id) ON DELETE SET NULL,
  pin_x numeric,
  pin_y numeric,
  -- Vrije tekst zolang er geen product is: "S1 sauna", "Drop Spa 2.0".
  note text,
  source public.product_link_source NOT NULL DEFAULT 'admin_manual',
  status public.product_link_status NOT NULL DEFAULT 'live',
  confidence numeric,
  suggested_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX project_brands_coarse_unique
  ON public.project_brands (project_id, brand_id)
  WHERE photo_id IS NULL;

CREATE UNIQUE INDEX project_brands_photo_unique
  ON public.project_brands (project_id, brand_id, photo_id)
  WHERE photo_id IS NOT NULL;

CREATE INDEX project_brands_brand_idx ON public.project_brands (brand_id);
CREATE INDEX project_brands_project_idx ON public.project_brands (project_id);

ALTER TABLE public.project_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_brands_admin_all" ON public.project_brands
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());
