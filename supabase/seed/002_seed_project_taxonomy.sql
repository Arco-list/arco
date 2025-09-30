-- Seed project categories, sub-types, and associated attributes
-- Requires categories table; will create project_category_attributes helper table if absent.

CREATE TABLE IF NOT EXISTS public.project_category_attributes (
  category_id uuid PRIMARY KEY REFERENCES public.categories(id) ON DELETE CASCADE,
  is_listable boolean NOT NULL DEFAULT false,
  is_building_feature boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_project_category_attributes_updated_at'
  ) THEN
    CREATE TRIGGER trg_project_category_attributes_updated_at
      BEFORE UPDATE ON public.project_category_attributes
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

DO $$
DECLARE
  rec record;
  parent_id uuid;
  child record;
  position integer;
  subtype_id uuid;
BEGIN
  FOR rec IN (
    SELECT DISTINCT category_name,
           lower(regexp_replace(category_name, '[^a-z0-9]+', '-', 'gi')) AS category_slug
    FROM (VALUES
      ('House', 'Villa', true, false),
      ('House', 'House', true, false),
      ('House', 'Apartment', true, false),
      ('House', 'Chalet', true, false),
      ('House', 'Bungalow', true, false),
      ('House', 'Farm', true, false),
      ('House', 'Extension', true, false),
      ('Kitchen & Living', 'Kitchen', true, true),
      ('Kitchen & Living', 'Living room', false, true),
      ('Kitchen & Living', 'Dining room', false, true),
      ('Kitchen & Living', 'Sunroom', false, true),
      ('Bed & Bath', 'Bathroom', true, true),
      ('Bed & Bath', 'Bedroom', false, true),
      ('Bed & Bath', 'Indoor Pool', false, true),
      ('Bed & Bath', 'Jacuzzi', true, true),
      ('Bed & Bath', 'Sauna', true, true),
      ('Bed & Bath', 'Steam room', false, true),
      ('Outdoor', 'Garden', true, true),
      ('Outdoor', 'Outdoor pool', true, true),
      ('Outdoor', 'Garden house', true, true),
      ('Outdoor', 'Outdoor kitchen', false, true),
      ('Outdoor', 'Garage', false, true),
      ('Outdoor', 'Porch', false, true),
      ('Other', 'Hall', false, true),
      ('Other', 'Home office', false, true),
      ('Other', 'Bar', false, true),
      ('Other', 'Cinema', false, true),
      ('Other', 'Gym', false, true),
      ('Other', 'Game room', false, true),
      ('Other', 'Kids room', false, true),
      ('Other', 'Wine cellar', false, true)
    ) AS t(category_name, subtype_name, is_listable, is_building_feature)
  ) LOOP
    INSERT INTO public.categories (name, slug, is_active)
    VALUES (rec.category_name, rec.category_slug, true)
    ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug, is_active = true
    RETURNING id INTO parent_id;

    IF parent_id IS NULL THEN
      SELECT id INTO parent_id FROM public.categories WHERE name = rec.category_name;
    END IF;

    position := 1;
    FOR child IN (
      SELECT subtype_name,
             is_listable,
             is_building_feature,
             lower(regexp_replace(rec.category_name || '-' || subtype_name, '[^a-z0-9]+', '-', 'gi')) AS subtype_slug
      FROM (VALUES
        ('House', 'Villa', true, false),
        ('House', 'House', true, false),
        ('House', 'Apartment', true, false),
        ('House', 'Chalet', true, false),
        ('House', 'Bungalow', true, false),
        ('House', 'Farm', true, false),
        ('House', 'Extension', true, false),
        ('Kitchen & Living', 'Kitchen', true, true),
        ('Kitchen & Living', 'Living room', false, true),
        ('Kitchen & Living', 'Dining room', false, true),
        ('Kitchen & Living', 'Sunroom', false, true),
        ('Bed & Bath', 'Bathroom', true, true),
        ('Bed & Bath', 'Bedroom', false, true),
        ('Bed & Bath', 'Indoor Pool', false, true),
        ('Bed & Bath', 'Jacuzzi', true, true),
        ('Bed & Bath', 'Sauna', true, true),
        ('Bed & Bath', 'Steam room', false, true),
        ('Outdoor', 'Garden', true, true),
        ('Outdoor', 'Outdoor pool', true, true),
        ('Outdoor', 'Garden house', true, true),
        ('Outdoor', 'Outdoor kitchen', false, true),
        ('Outdoor', 'Garage', false, true),
        ('Outdoor', 'Porch', false, true),
        ('Other', 'Hall', false, true),
        ('Other', 'Home office', false, true),
        ('Other', 'Bar', false, true),
        ('Other', 'Cinema', false, true),
        ('Other', 'Gym', false, true),
        ('Other', 'Game room', false, true),
        ('Other', 'Kids room', false, true),
        ('Other', 'Wine cellar', false, true)
      ) AS values_table(category_name, subtype_name, is_listable, is_building_feature)
      WHERE values_table.category_name = rec.category_name
      ORDER BY subtype_name
    ) LOOP
      IF child.subtype_name = rec.category_name THEN
        -- Use parent row for matching subtype; just update attributes
        INSERT INTO public.project_category_attributes (category_id, is_listable, is_building_feature)
        VALUES (parent_id, child.is_listable, child.is_building_feature)
        ON CONFLICT (category_id)
          DO UPDATE SET is_listable = EXCLUDED.is_listable,
                        is_building_feature = EXCLUDED.is_building_feature,
                        updated_at = now();
      ELSE
        INSERT INTO public.categories (name, slug, parent_id, is_active, sort_order)
        VALUES (child.subtype_name, child.subtype_slug, parent_id, true, position)
        ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id,
                                          slug = EXCLUDED.slug,
                                          is_active = true
        RETURNING id INTO subtype_id;

        IF subtype_id IS NULL THEN
          SELECT id INTO subtype_id FROM public.categories WHERE name = child.subtype_name;
        END IF;

        INSERT INTO public.project_category_attributes (category_id, is_listable, is_building_feature)
        VALUES (subtype_id, child.is_listable, child.is_building_feature)
        ON CONFLICT (category_id)
          DO UPDATE SET is_listable = EXCLUDED.is_listable,
                        is_building_feature = EXCLUDED.is_building_feature,
                        updated_at = now();

        position := position + 1;
      END IF;
    END LOOP;
  END LOOP;
END $$;
