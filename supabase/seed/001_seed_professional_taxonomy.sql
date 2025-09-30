-- Seed professional categories and services
-- Run after Phase 1 migrations. Idempotent via slug-based upserts.

DO $$
DECLARE
  rec record;
  parent_id uuid;
  child record;
  position integer;
BEGIN
  FOR rec IN (
    SELECT DISTINCT category_name,
           lower(regexp_replace(category_name, '[^a-z0-9]+', '-', 'gi')) AS category_slug
    FROM (VALUES
      ('Design & Planning', 'Architecture'),
      ('Design & Planning', 'Interior design'),
      ('Design & Planning', 'Garden design'),
      ('Construction', 'General contractor'),
      ('Construction', 'Roof'),
      ('Construction', 'Tiles and stone'),
      ('Construction', 'Kitchen'),
      ('Construction', 'Stairs'),
      ('Construction', 'Elevator'),
      ('Construction', 'Windows'),
      ('Construction', 'Bathroom'),
      ('Construction', 'Swimming pool'),
      ('Construction', 'Welness'),
      ('Construction', 'Doors'),
      ('Systems', 'Lighting'),
      ('Systems', 'Electrical systems'),
      ('Systems', 'Security systems'),
      ('Systems', 'Domotica'),
      ('Finishing', 'Interior fit-out'),
      ('Finishing', 'Fireplace'),
      ('Finishing', 'Interior styling'),
      ('Finishing', 'Painting'),
      ('Finishing', 'Decoration and carpentry'),
      ('Finishing', 'Indoor plants'),
      ('Finishing', 'Floor'),
      ('Finishing', 'Furniture'),
      ('Finishing', 'Art'),
      ('Outdoor', 'Outdoor lighting'),
      ('Outdoor', 'Garden'),
      ('Outdoor', 'Garden house'),
      ('Outdoor', 'Outdoor furniture'),
      ('Outdoor', 'Fencing and gates')
    ) AS t(category_name, service_name)
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
      SELECT service_name,
             lower(regexp_replace(rec.category_name || '-' || service_name, '[^a-z0-9]+', '-', 'gi')) AS service_slug
      FROM (VALUES
        ('Design & Planning', 'Architecture'),
        ('Design & Planning', 'Interior design'),
        ('Design & Planning', 'Garden design'),
        ('Construction', 'General contractor'),
        ('Construction', 'Roof'),
        ('Construction', 'Tiles and stone'),
        ('Construction', 'Kitchen'),
        ('Construction', 'Stairs'),
        ('Construction', 'Elevator'),
        ('Construction', 'Windows'),
        ('Construction', 'Bathroom'),
        ('Construction', 'Swimming pool'),
        ('Construction', 'Welness'),
        ('Construction', 'Doors'),
        ('Systems', 'Lighting'),
        ('Systems', 'Electrical systems'),
        ('Systems', 'Security systems'),
        ('Systems', 'Domotica'),
        ('Finishing', 'Interior fit-out'),
        ('Finishing', 'Fireplace'),
        ('Finishing', 'Interior styling'),
        ('Finishing', 'Painting'),
        ('Finishing', 'Decoration and carpentry'),
        ('Finishing', 'Indoor plants'),
        ('Finishing', 'Floor'),
        ('Finishing', 'Furniture'),
        ('Finishing', 'Art'),
        ('Outdoor', 'Outdoor lighting'),
        ('Outdoor', 'Garden'),
        ('Outdoor', 'Garden house'),
        ('Outdoor', 'Outdoor furniture'),
        ('Outdoor', 'Fencing and gates')
      ) AS values_table(category_name, service_name)
      WHERE values_table.category_name = rec.category_name
      ORDER BY service_name
    ) LOOP
      INSERT INTO public.categories (name, slug, parent_id, is_active, sort_order)
      VALUES (child.service_name, child.service_slug, parent_id, true, position)
      ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id,
                                        slug = EXCLUDED.slug,
                                        is_active = true;

      position := position + 1;
    END LOOP;
  END LOOP;
END $$;

-- Optional: set icons or other metadata after this seed runs.
