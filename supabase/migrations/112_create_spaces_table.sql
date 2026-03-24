-- Migration: Create dedicated spaces table for photo tagging
-- Decouples room/space definitions from the categories table.

-- 1. Create spaces table
CREATE TABLE public.spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  icon_key text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.spaces IS 'Predefined room/zone types used to tag project photos';

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Spaces are viewable by everyone"
  ON public.spaces FOR SELECT
  USING (true);

-- 2. Seed the canonical space list
INSERT INTO public.spaces (name, slug, icon_key, sort_order) VALUES
  ('Kitchen',     'kitchen',     'kitchen',     1),
  ('Living Room', 'living-room', 'living_room', 2),
  ('Bedroom',     'bedroom',     'bedroom',     3),
  ('Bathroom',    'bathroom',    'bathroom',    4),
  ('Dining Room', 'dining-room', 'dining_room', 5),
  ('Home Office', 'home-office', 'office',      6),
  ('Garden',      'garden',      'garden',      7),
  ('Pool',        'pool',        'pool',        8),
  ('Terrace',     'terrace',     'terrace',     9),
  ('Exterior',    'exterior',    'exterior',    10);

-- 3. Add space_id column to project_features
ALTER TABLE public.project_features
  ADD COLUMN space_id uuid REFERENCES public.spaces(id) ON DELETE SET NULL;

CREATE INDEX idx_project_features_space_id ON public.project_features(space_id);

-- 4. Populate space_id from existing category_id data
WITH mapping(category_name, space_slug) AS (VALUES
  ('Kitchen',         'kitchen'),
  ('Living room',     'living-room'),
  ('Dining room',     'dining-room'),
  ('Bathroom',        'bathroom'),
  ('Bedroom',         'bedroom'),
  ('Garden',          'garden'),
  ('Outdoor pool',    'pool'),
  ('Indoor Pool',     'pool'),
  ('Home office',     'home-office'),
  ('Hall',            'exterior'),
  ('Garage',          'exterior'),
  ('Porch',           'exterior'),
  ('Garden house',    'exterior'),
  ('Outdoor kitchen', 'kitchen'),
  ('Balcony',         'terrace'),
  ('Terrace',         'terrace'),
  ('Sunroom',         'living-room'),
  ('Jacuzzi',         'pool'),
  ('Sauna',           'bathroom'),
  ('Steam room',      'bathroom'),
  ('Bar',             'living-room'),
  ('Cinema',          'living-room'),
  ('Gym',             'exterior'),
  ('Game room',       'living-room'),
  ('Kids room',       'bedroom'),
  ('Wine cellar',     'kitchen')
)
UPDATE public.project_features pf
SET space_id = s.id
FROM public.categories c
JOIN mapping m ON lower(c.name) = lower(m.category_name)
JOIN public.spaces s ON s.slug = m.space_slug
WHERE pf.category_id = c.id
  AND pf.space_id IS NULL;
