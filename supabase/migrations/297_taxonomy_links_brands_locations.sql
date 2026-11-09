-- 297: de samenhang tussen diensten, ruimtes en producten; deelprojecten;
-- merken op bedrijven; vestigingen. En opruimen wat ervoor in de weg zat.
--
-- Drie assen, elk met één rol. Type zegt wat het gebouw is, Ruimte zegt
-- waar je kijkt, Dienst zegt wie het maakte. Een deelproject (een keuken,
-- een zwembad) is geen apart projecttype maar een project met kind =
-- 'partial', een ruimte als ingang en een dienst als maker.

-- ── 1. Publiceerstand per dienst ─────────────────────────────────────────
-- none: publiceert niet (fotograaf, schilder); project: architectuur-
-- projecten (architect, interieurarchitect); partial: deelprojecten,
-- zichtbaar onder een ruimtefilter (keukens, badkamers, zwembaden, …).
-- can_publish_projects blijft bestaan en volgt deze kolom via trigger:
-- de code die er op leest (entitlements, welkomstmail, admin) blijft
-- werken zonder dat er twee waarheden zijn.
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS publish_scope text NOT NULL DEFAULT 'none'
  CHECK (publish_scope IN ('none', 'project', 'partial'));

UPDATE public.categories SET publish_scope = 'project'
WHERE category_type = 'Professional' AND slug IN ('architect', 'interior-designer');
UPDATE public.categories SET publish_scope = 'partial'
WHERE category_type = 'Professional'
  AND slug IN ('garden-designer', 'kitchens', 'bathrooms', 'swimming-pools', 'wellness', 'shed-builder');
UPDATE public.categories SET can_publish_projects = (publish_scope <> 'none')
WHERE category_type = 'Professional';

CREATE OR REPLACE FUNCTION public.categories_sync_can_publish()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.can_publish_projects := (NEW.publish_scope <> 'none');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS categories_sync_can_publish ON public.categories;
CREATE TRIGGER categories_sync_can_publish
  BEFORE INSERT OR UPDATE OF publish_scope ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.categories_sync_can_publish();

-- ── 2. Samenhang: dienst ↔ ruimte, productgroep ↔ ruimte ─────────────────
-- Beheerd op /admin/categories (tab Samenhang). Dienst → ruimte zegt
-- waar het werk van een dienst zichtbaar wordt (Kitchens → kitchen);
-- productgroep → ruimte zegt waar een productgroep thuishoort (Keukens →
-- kitchen). Via de ruimte vinden diensten en productgroepen elkaar, en
-- daarmee een keukenbouwer de merken die bij hem passen.
CREATE TABLE IF NOT EXISTS public.service_spaces (
  service_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  space_id   uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (service_id, space_id)
);
CREATE INDEX IF NOT EXISTS idx_service_spaces_space ON public.service_spaces(space_id);

CREATE TABLE IF NOT EXISTS public.product_category_spaces (
  product_category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  space_id            uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_category_id, space_id)
);
CREATE INDEX IF NOT EXISTS idx_product_category_spaces_space ON public.product_category_spaces(space_id);

ALTER TABLE public.service_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_category_spaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_spaces_read ON public.service_spaces;
CREATE POLICY service_spaces_read ON public.service_spaces FOR SELECT USING (true);
DROP POLICY IF EXISTS service_spaces_admin ON public.service_spaces;
CREATE POLICY service_spaces_admin ON public.service_spaces FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS product_category_spaces_read ON public.product_category_spaces;
CREATE POLICY product_category_spaces_read ON public.product_category_spaces FOR SELECT USING (true);
DROP POLICY IF EXISTS product_category_spaces_admin ON public.product_category_spaces;
CREATE POLICY product_category_spaces_admin ON public.product_category_spaces FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Startwaarden: de diensten die deelprojecten publiceren en de ruimte
-- waarin dat werk zichtbaar is. Wellness heeft geen eigen ruimte; tot
-- die er is telt het mee bij badkamer en zwembad. Exterieur en Overig
-- zijn ruimtes voor hele projecten, geen deelprojecten.
INSERT INTO public.service_spaces (service_id, space_id)
SELECT c.id, s.id
FROM public.categories c
JOIN public.spaces s ON s.slug = ANY (
  CASE c.slug
    WHEN 'kitchens'        THEN ARRAY['kitchen']
    WHEN 'bathrooms'       THEN ARRAY['bathroom']
    WHEN 'swimming-pools'  THEN ARRAY['pool']
    WHEN 'wellness'        THEN ARRAY['bathroom', 'pool']
    WHEN 'garden-designer' THEN ARRAY['garden', 'terrace']
    WHEN 'shed-builder'    THEN ARRAY['garden']
    ELSE ARRAY[]::text[]
  END)
WHERE c.category_type = 'Professional'
ON CONFLICT DO NOTHING;

-- ── 3. Deelprojecten ─────────────────────────────────────────────────────
-- kind: 'project' (architectuurproject, de hoofdgrid) of 'partial'
-- (deelproject: alleen zichtbaar onder een actief ruimtefilter, op de
-- ruimtehubs en op de pagina van de maker). parent_project_id: het
-- moederproject waar het deel in zit (de keuken in die ene villa) —
-- gereserveerd, uitwerking volgt.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'project'
  CHECK (kind IN ('project', 'partial'));
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS parent_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_kind ON public.projects(kind) WHERE kind <> 'project';
CREATE INDEX IF NOT EXISTS idx_projects_parent ON public.projects(parent_project_id) WHERE parent_project_id IS NOT NULL;

-- De zoekdocumenten krijgen kind en moederproject mee, zodat de discover
-- deelprojecten kan wegfilteren zonder extra query. Kolommen komen
-- achteraan; CREATE OR REPLACE staat dat toe.
CREATE OR REPLACE VIEW public.project_search_documents AS
 SELECT doc.id,
    doc.title,
    doc.description,
    doc.translations,
    doc.location,
    doc.project_type,
    doc.building_type,
    doc.style_preferences,
    doc.features,
    doc.is_featured,
    doc.likes_count,
    doc.views_count,
    doc.status,
    doc.slug,
    doc.project_year,
    doc.client_first_name,
    doc.client_last_name,
    doc.client_avatar,
    doc.primary_photo_url,
    doc.primary_photo_alt,
    doc.primary_category,
    doc.primary_category_slug,
    doc.primary_category_icon,
    doc.primary_category_color,
    doc.photo_count,
    doc.created_at,
    doc.updated_at,
    doc.search_vector,
    doc.credited_count,
    row_number() OVER (
      PARTITION BY doc.is_featured, (COALESCE(doc.project_type, 'other'::text))
      ORDER BY doc.credited_count DESC, (COALESCE(doc.views_count, 0)) DESC, doc.created_at DESC
    )::integer AS scope_rotation,
    pr.address_city,
    pr.address_region,
    pr.kind,
    pr.parent_project_id
   FROM ( SELECT p.*,
            ( SELECT count(*)::integer
                FROM project_professionals pp
               WHERE pp.project_id = p.id
                 AND (pp.status = ANY (ARRAY['live_on_page'::professional_project_status,
                                             'listed'::professional_project_status]))) AS credited_count
           FROM ( SELECT mv.*,
                    to_tsvector('simple'::regconfig,
                      TRIM(BOTH ' ' FROM concat_ws(' ',
                        mv.title,
                        mv.slug,
                        mv.description,
                        mv.location,
                        mv.primary_category,
                        mv.primary_category_slug,
                        mv.project_type,
                        mv.building_type,
                        array_to_string(COALESCE(mv.style_preferences, ARRAY[]::text[]), ' '),
                        array_to_string(COALESCE(mv.features, ARRAY[]::text[]), ' ')
                      ))) AS search_vector
                   FROM mv_project_summary mv) p) doc
     LEFT JOIN projects pr ON pr.id = doc.id;

-- ── 4. Merken op bedrijven ───────────────────────────────────────────────
-- Eén tabel, twee kanten: "Merken" op de bedrijfspagina, "Verkooppunten"
-- op de merkpagina. is_official_dealer is de claim van het bedrijf; hoe
-- die bevestigd wordt (merkeigenaar, admin) wordt later bepaald.
CREATE TABLE IF NOT EXISTS public.company_brands (
  company_id         uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  brand_id           uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  is_official_dealer boolean NOT NULL DEFAULT false,
  position           integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (company_id, brand_id)
);
CREATE INDEX IF NOT EXISTS idx_company_brands_brand ON public.company_brands(brand_id);

ALTER TABLE public.company_brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_brands_read ON public.company_brands;
CREATE POLICY company_brands_read ON public.company_brands FOR SELECT USING (true);
DROP POLICY IF EXISTS company_brands_owner_write ON public.company_brands;
CREATE POLICY company_brands_owner_write ON public.company_brands FOR ALL
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_brands.company_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_brands.company_id AND c.owner_id = auth.uid()));
DROP POLICY IF EXISTS company_brands_team_write ON public.company_brands;
CREATE POLICY company_brands_team_write ON public.company_brands FOR ALL
  USING (public.is_company_editor(company_id)) WITH CHECK (public.is_company_editor(company_id));
DROP POLICY IF EXISTS company_brands_admin ON public.company_brands;
CREATE POLICY company_brands_admin ON public.company_brands FOR ALL
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- ── 5. Vestigingen ───────────────────────────────────────────────────────
-- Showrooms, winkels, kantoren en werkplaatsen van een bedrijf óf van een
-- merk (flagship store). Eén tabel, zodat "alle showrooms van merk X" —
-- eigen winkels plus die van zijn dealers — één query is. Het adres op
-- companies blijft het hoofdadres voor zoeken en facetten.
CREATE TABLE IF NOT EXISTS public.locations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  brand_id        uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  kind            text NOT NULL DEFAULT 'showroom' CHECK (kind IN ('showroom', 'store', 'office', 'workshop')),
  name            text,
  address         text,
  street_address  text,
  postal_code     text,
  city            text,
  state_region    text,
  country         text,
  google_place_id text,
  latitude        numeric,
  longitude       numeric,
  phone           text,
  email           text,
  website         text,
  opening_hours   text,
  position        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(company_id, brand_id) = 1)
);
CREATE INDEX IF NOT EXISTS idx_locations_company ON public.locations(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_locations_brand ON public.locations(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_locations_city ON public.locations(city);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS locations_read ON public.locations;
CREATE POLICY locations_read ON public.locations FOR SELECT USING (true);
DROP POLICY IF EXISTS locations_owner_write ON public.locations;
CREATE POLICY locations_owner_write ON public.locations FOR ALL
  USING (company_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = locations.company_id AND c.owner_id = auth.uid()))
  WITH CHECK (company_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = locations.company_id AND c.owner_id = auth.uid()));
DROP POLICY IF EXISTS locations_team_write ON public.locations;
CREATE POLICY locations_team_write ON public.locations FOR ALL
  USING (company_id IS NOT NULL AND public.is_company_editor(company_id))
  WITH CHECK (company_id IS NOT NULL AND public.is_company_editor(company_id));
DROP POLICY IF EXISTS locations_admin ON public.locations;
CREATE POLICY locations_admin ON public.locations FOR ALL
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- ── 6. Opruimen ──────────────────────────────────────────────────────────
-- De oude deelproject-"types" (Kitchen & Living, Bed & Bath, Outdoor,
-- Other en hun kinderen, plus Garden design) dupliceerden de ruimtes en
-- hadden nul projecten. De groep House blijft: vier projecten en een
-- Pinterest-bord hangen eraan.
DELETE FROM public.categories
WHERE category_type = 'Project'
  AND (slug = 'garden-design'
       OR slug IN ('kitchen-living', 'bed-bath', 'outdoor', 'other')
       OR parent_id IN (SELECT id FROM public.categories WHERE category_type = 'Project' AND slug IN ('kitchen-living', 'bed-bath', 'outdoor', 'other')));

-- De losse retailers-tabel uit de oude productlaag (129) was leeg en wees
-- niet naar companies; company_brands vervangt haar.
DROP TABLE IF EXISTS public.brand_retailers;
DROP TABLE IF EXISTS public.retailers;
