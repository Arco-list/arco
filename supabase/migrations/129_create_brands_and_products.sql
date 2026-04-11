-- ═══════════════════════════════════════════════════════════════════════
-- 129: Brands and Products
-- ═══════════════════════════════════════════════════════════════════════
-- Creates the third pillar of Arco — alongside Projects and Professionals.
-- Brand → Product Family → Product → Variants. Products are the unit of
-- discovery. Variants are JSONB attributes (size, color, finish).
--
-- Status enums mirror the company/project pattern.
-- The full strategy doc lives in Notion → Proposition → Products.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Status enums ────────────────────────────────────────────────────────

CREATE TYPE public.brand_status AS ENUM (
  'unclaimed',    -- scraped, not claimed, admin-only URL (no public indexing)
  'prospected',   -- scraped, not claimed, used in outreach
  'unlisted',     -- claimed but hidden from public directories
  'listed',       -- claimed and live, fully discoverable
  'deactivated'   -- removed by admin (e.g. brand requested removal)
);

CREATE TYPE public.product_status AS ENUM (
  'listed',       -- visible (subject to brand status intersection)
  'unlisted'      -- hidden from public, accessible by direct link only
);

CREATE TYPE public.product_link_source AS ENUM (
  'ai',                  -- CLIP retrieval + Claude vision rerank
  'brand_suggest',       -- brand proposed the link
  'pro_suggest',         -- verified professional proposed the link
  'admin_manual'         -- admin created or verified directly
);

CREATE TYPE public.product_link_status AS ENUM (
  'pending',      -- awaiting admin review
  'live',         -- approved and publicly visible
  'rejected'      -- declined; permanently hidden
);

-- ─── Brands ──────────────────────────────────────────────────────────────

CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  domain text UNIQUE,
  website text,
  logo_url text,
  description text,
  country text,
  founded_year integer,
  status public.brand_status NOT NULL DEFAULT 'unclaimed',
  is_verified boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  -- Auto-approve flag mirrors companies.auto_approve_projects: once an
  -- admin has approved one product-link suggestion from this brand, all
  -- subsequent suggestions go live without review until revoked.
  auto_approve_product_links boolean NOT NULL DEFAULT false,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_brands_status ON public.brands(status);
CREATE INDEX idx_brands_slug ON public.brands(slug);
CREATE INDEX idx_brands_domain ON public.brands(domain);
CREATE INDEX idx_brands_owner_user_id ON public.brands(owner_user_id);

-- ─── Product categories (hierarchical taxonomy) ──────────────────────────
-- Dedicated taxonomy for products. Separate from project_taxonomy_options
-- because product categories don't map cleanly to project filters
-- (e.g. "lounge chair" is a product, not a project style).

CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES public.product_categories(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_categories_parent_id ON public.product_categories(parent_id);
CREATE INDEX idx_product_categories_slug ON public.product_categories(slug);

-- ─── Product families ────────────────────────────────────────────────────
-- Groups related products from the same brand (e.g. Occhio Mito).
-- Optional — products without a family link directly to the brand.

CREATE TABLE public.product_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  hero_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Slug is unique within a brand (e.g. occhio/mito), not globally
  UNIQUE (brand_id, slug)
);

CREATE INDEX idx_product_families_brand_id ON public.product_families(brand_id);

-- ─── Products ────────────────────────────────────────────────────────────

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  family_id uuid REFERENCES public.product_families(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  -- Specs is a flexible key-value bag because every category has different
  -- attributes (lighting → wattage/lumen, furniture → dimensions/material,
  -- bathroom → flow rate/finish). Free-form to avoid schema explosion.
  specs jsonb,
  -- Variants captures the same product in different sizes, colors,
  -- materials, finishes. Example for Mito Sospeso 40 phantom:
  -- [{size: "40cm", color: "phantom"}, {size: "60cm", color: "gold"}]
  -- Variants share the parent product's photos for AI matching.
  variants jsonb,
  source_url text,
  status public.product_status NOT NULL DEFAULT 'listed',
  is_featured boolean NOT NULL DEFAULT false,
  scraped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_brand_id ON public.products(brand_id);
CREATE INDEX idx_products_family_id ON public.products(family_id);
CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_slug ON public.products(slug);

-- Full-text search across name + description for the discover page
CREATE INDEX idx_products_search ON public.products
  USING gin(to_tsvector('simple', name || ' ' || COALESCE(description, '')));

-- ─── Product photos ──────────────────────────────────────────────────────
-- Hotlinked from brand CDN by default during preview. Brands can upload
-- their own assets after claim.
--
-- The embedding column is reserved for CLIP/SigLIP vectors used in the
-- AI matching pipeline (Phase 3). pgvector is enabled conditionally so
-- this migration runs even if the extension isn't installed yet — the
-- column is added in a follow-up migration once pgvector is available.

CREATE TABLE public.product_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt_text text,
  attribution text,  -- "Image: [Brand Name]"
  is_primary boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_photos_product_id ON public.product_photos(product_id);
CREATE INDEX idx_product_photos_is_primary ON public.product_photos(is_primary)
  WHERE is_primary = true;

-- ─── Retailers ───────────────────────────────────────────────────────────
-- Retailers display brand distribution at the brand level, not the product
-- level. The brand_retailers table is the join. v1 keeps it simple: a
-- retailer is a physical or online store carrying one or more brands.

CREATE TABLE public.retailers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  website text,
  email text,
  phone text,
  address text,
  city text,
  country text,
  latitude numeric,
  longitude numeric,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_retailers_city ON public.retailers(city);

CREATE TABLE public.brand_retailers (
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  is_official_dealer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, retailer_id)
);

CREATE INDEX idx_brand_retailers_retailer_id ON public.brand_retailers(retailer_id);

-- ─── Project ↔ Product links ─────────────────────────────────────────────
-- The bridge that makes the whole product graph valuable. Each row pins a
-- product to a specific photo on a specific project, with x/y coordinates
-- for the dot overlay UX. Source tracks how the link was created
-- (AI / brand suggest / pro suggest / admin manual).

CREATE TABLE public.project_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES public.project_photos(id) ON DELETE CASCADE,
  -- Pin position on the photo (0–1 normalized) for the dot overlay
  pin_x numeric,
  pin_y numeric,
  source public.product_link_source NOT NULL,
  status public.product_link_status NOT NULL DEFAULT 'pending',
  -- AI-only: confidence score from the matching pipeline (0.0–1.0)
  confidence numeric,
  suggested_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Prevent duplicate links: one product per photo
  UNIQUE (photo_id, product_id)
);

CREATE INDEX idx_project_products_project_id ON public.project_products(project_id);
CREATE INDEX idx_project_products_product_id ON public.project_products(product_id);
CREATE INDEX idx_project_products_photo_id ON public.project_products(photo_id);
CREATE INDEX idx_project_products_status ON public.project_products(status);

-- ─── Saved products (mirrors saved_projects pattern) ─────────────────────

CREATE TABLE public.saved_products (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX idx_saved_products_product_id ON public.saved_products(product_id);

-- ─── updated_at triggers ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER brands_set_updated_at BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER product_families_set_updated_at BEFORE UPDATE ON public.product_families
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER retailers_set_updated_at BEFORE UPDATE ON public.retailers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────
-- Phase 1 is admin-only. We enable RLS on all tables and write policies
-- that grant read access only to admins. When the public launch happens
-- (Phase 4), these policies will be relaxed via a follow-up migration.

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_retailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_products ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin?
-- Reuses the same admin check pattern as other tables.
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND ('admin' = ANY(user_types) OR admin_role IS NOT NULL)
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Admin-only read/write policies (Phase 1)
CREATE POLICY "brands_admin_all" ON public.brands FOR ALL USING (public.is_admin_user());
CREATE POLICY "product_categories_admin_all" ON public.product_categories FOR ALL USING (public.is_admin_user());
CREATE POLICY "product_families_admin_all" ON public.product_families FOR ALL USING (public.is_admin_user());
CREATE POLICY "products_admin_all" ON public.products FOR ALL USING (public.is_admin_user());
CREATE POLICY "product_photos_admin_all" ON public.product_photos FOR ALL USING (public.is_admin_user());
CREATE POLICY "retailers_admin_all" ON public.retailers FOR ALL USING (public.is_admin_user());
CREATE POLICY "brand_retailers_admin_all" ON public.brand_retailers FOR ALL USING (public.is_admin_user());
CREATE POLICY "project_products_admin_all" ON public.project_products FOR ALL USING (public.is_admin_user());

-- Saved products: users manage their own
CREATE POLICY "saved_products_own" ON public.saved_products
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── Seed taxonomy ───────────────────────────────────────────────────────
-- 6 top-level categories, ~35 leaf categories. Locked in the strategy doc.

DO $$
DECLARE
  cat_furniture uuid;
  cat_lighting uuid;
  cat_kitchen uuid;
  cat_bathroom uuid;
  cat_outdoor uuid;
  cat_finishes uuid;
  sub_seating uuid;
  sub_tables uuid;
  sub_storage uuid;
  sub_beds uuid;
  sub_appliances uuid;
  sub_outdoor_furniture uuid;
  sub_outdoor_fireplaces uuid;
BEGIN
  -- Top-level
  INSERT INTO public.product_categories (slug, name, order_index) VALUES ('furniture', 'Furniture', 1) RETURNING id INTO cat_furniture;
  INSERT INTO public.product_categories (slug, name, order_index) VALUES ('lighting', 'Lighting', 2) RETURNING id INTO cat_lighting;
  INSERT INTO public.product_categories (slug, name, order_index) VALUES ('kitchen', 'Kitchen', 3) RETURNING id INTO cat_kitchen;
  INSERT INTO public.product_categories (slug, name, order_index) VALUES ('bathroom', 'Bathroom', 4) RETURNING id INTO cat_bathroom;
  INSERT INTO public.product_categories (slug, name, order_index) VALUES ('outdoor', 'Outdoor', 5) RETURNING id INTO cat_outdoor;
  INSERT INTO public.product_categories (slug, name, order_index) VALUES ('finishes', 'Finishes', 6) RETURNING id INTO cat_finishes;

  -- Furniture > Seating, Tables, Storage, Beds
  INSERT INTO public.product_categories (slug, name, parent_id, order_index) VALUES ('seating', 'Seating', cat_furniture, 1) RETURNING id INTO sub_seating;
  INSERT INTO public.product_categories (slug, name, parent_id, order_index) VALUES ('tables', 'Tables', cat_furniture, 2) RETURNING id INTO sub_tables;
  INSERT INTO public.product_categories (slug, name, parent_id, order_index) VALUES ('storage', 'Storage', cat_furniture, 3) RETURNING id INTO sub_storage;
  INSERT INTO public.product_categories (slug, name, parent_id, order_index) VALUES ('beds', 'Beds', cat_furniture, 4) RETURNING id INTO sub_beds;

  INSERT INTO public.product_categories (slug, name, parent_id, order_index) VALUES
    ('lounge-chair', 'Lounge chair', sub_seating, 1),
    ('dining-chair', 'Dining chair', sub_seating, 2),
    ('bar-stool', 'Bar stool', sub_seating, 3),
    ('sofa', 'Sofa', sub_seating, 4),
    ('armchair', 'Armchair', sub_seating, 5),
    ('bench', 'Bench', sub_seating, 6),
    ('dining-table', 'Dining table', sub_tables, 1),
    ('coffee-table', 'Coffee table', sub_tables, 2),
    ('side-table', 'Side table', sub_tables, 3),
    ('console', 'Console', sub_tables, 4),
    ('desk', 'Desk', sub_tables, 5),
    ('bookshelf', 'Bookshelf', sub_storage, 1),
    ('cabinet', 'Cabinet', sub_storage, 2),
    ('sideboard', 'Sideboard', sub_storage, 3),
    ('wardrobe', 'Wardrobe', sub_storage, 4),
    ('bed-frame', 'Bed frame', sub_beds, 1),
    ('headboard', 'Headboard', sub_beds, 2);

  -- Lighting (flat — no sub-groups in v1)
  INSERT INTO public.product_categories (slug, name, parent_id, order_index) VALUES
    ('pendant', 'Pendant', cat_lighting, 1),
    ('floor-lamp', 'Floor lamp', cat_lighting, 2),
    ('table-lamp', 'Table lamp', cat_lighting, 3),
    ('wall-lamp', 'Wall lamp', cat_lighting, 4),
    ('ceiling-light', 'Ceiling', cat_lighting, 5),
    ('outdoor-lighting', 'Outdoor lighting', cat_lighting, 6);

  -- Kitchen
  INSERT INTO public.product_categories (slug, name, parent_id, order_index) VALUES ('kitchen-appliances', 'Appliances', cat_kitchen, 6) RETURNING id INTO sub_appliances;
  INSERT INTO public.product_categories (slug, name, parent_id, order_index) VALUES
    ('cabinetry', 'Cabinetry', cat_kitchen, 1),
    ('kitchen-islands', 'Islands', cat_kitchen, 2),
    ('countertops', 'Countertops', cat_kitchen, 3),
    ('kitchen-faucets', 'Faucets & fittings', cat_kitchen, 4),
    ('kitchen-sinks', 'Sinks', cat_kitchen, 5);

  INSERT INTO public.product_categories (slug, name, parent_id, order_index) VALUES
    ('cooktops-ovens', 'Cooktops & ovens', sub_appliances, 1),
    ('refrigeration', 'Refrigeration', sub_appliances, 2),
    ('dishwashers', 'Dishwashers', sub_appliances, 3),
    ('ventilation', 'Ventilation', sub_appliances, 4);

  -- Bathroom
  INSERT INTO public.product_categories (slug, name, parent_id, order_index) VALUES
    ('bathroom-fittings', 'Fittings', cat_bathroom, 1),
    ('bathroom-fixtures', 'Fixtures', cat_bathroom, 2),
    ('vanities', 'Vanities', cat_bathroom, 3),
    ('showers', 'Showers', cat_bathroom, 4),
    ('bathroom-accessories', 'Accessories', cat_bathroom, 5);

  -- Outdoor
  INSERT INTO public.product_categories (slug, name, parent_id, order_index) VALUES ('outdoor-furniture', 'Furniture', cat_outdoor, 1) RETURNING id INTO sub_outdoor_furniture;
  INSERT INTO public.product_categories (slug, name, parent_id, order_index) VALUES ('outdoor-fireplaces', 'Fireplaces', cat_outdoor, 3) RETURNING id INTO sub_outdoor_fireplaces;
  INSERT INTO public.product_categories (slug, name, parent_id, order_index) VALUES
    ('bbq-grills', 'BBQ & grills', cat_outdoor, 2),
    ('pools', 'Pools', cat_outdoor, 4),
    ('spas-saunas', 'Spas & saunas', cat_outdoor, 5),
    ('outdoor-heating', 'Heating', cat_outdoor, 6);

  INSERT INTO public.product_categories (slug, name, parent_id, order_index) VALUES
    ('outdoor-lounge-seating', 'Lounge seating', sub_outdoor_furniture, 1),
    ('outdoor-dining', 'Dining furniture', sub_outdoor_furniture, 2),
    ('sun-loungers', 'Sun loungers', sub_outdoor_furniture, 3);

  -- Finishes
  INSERT INTO public.product_categories (slug, name, parent_id, order_index) VALUES
    ('doors', 'Doors', cat_finishes, 1),
    ('radiators', 'Radiators', cat_finishes, 2),
    ('indoor-fireplaces', 'Indoor fireplaces', cat_finishes, 3),
    ('hardware', 'Hardware', cat_finishes, 4);
END $$;
