-- Maatvarianten zijn geen producten. Bij zes collecties las de pijplijn de
-- maten van één stuk als losse producten (Moon 60 / 80 / 120 …). Per
-- collectie blijft er één product over onder de naam van de collectie, met
-- de productfoto van de collectie als het zelf geen beeld heeft. De prompt
-- is aangepast (lib/collections/prompts), dus nieuwe collecties krijgen
-- dit niet meer.
--
-- Werkt ook na een nieuwe ronde: staat er al een product onder de naam van
-- de collectie (de nieuwe prompt), dan gaan alleen de maten ernaast weg.
CREATE TEMP TABLE collapse_targets(collection_id uuid) ON COMMIT DROP;
INSERT INTO collapse_targets VALUES
  ('375a88e2-fa31-4c0b-bb3f-c4545c87eaab'), -- Davide Groppi · Moon
  ('d143e95a-3d1f-409d-aeea-4d82fdb5f2f5'), -- Davide Groppi · Calvino
  ('596c552b-4cd2-4de3-96e3-0a4af0a1c55b'), -- Davide Groppi · Sampei
  ('54da3764-b46a-4d70-bb15-a24600908d1c'), -- Davide Groppi · Umasi
  ('f2014cae-cadf-463c-9f89-6dab16b1bc8f'), -- Davide Groppi · Umasi S
  ('6a724719-1a84-4f57-80bd-a79e42576b86'); -- Penta · Storm

-- 1. Al een product onder de naam van de collectie: de rest weg.
DELETE FROM public.products p
USING public.product_collections c, collapse_targets t
WHERE p.collection_id = c.id AND c.id = t.collection_id
  AND p.slug <> c.slug
  AND EXISTS (SELECT 1 FROM public.products q WHERE q.collection_id = c.id AND q.slug = c.slug);

-- 2. Anders: alleen de eerste blijft …
DELETE FROM public.products p
USING (
  SELECT p2.id, row_number() OVER (PARTITION BY p2.collection_id ORDER BY p2.position, p2.created_at) AS rn
  FROM public.products p2 JOIN collapse_targets t ON t.collection_id = p2.collection_id
) r
WHERE p.id = r.id AND r.rn > 1;

-- 3. … onder de naam van de collectie, met een beeld.
UPDATE public.products p
SET name = c.name,
    slug = c.slug,
    image_url = COALESCE(p.image_url, (
      SELECT ph.url FROM public.product_collection_photos ph
      WHERE ph.collection_id = c.id AND ph.kind = 'product'
      ORDER BY ph.order_index LIMIT 1
    )),
    updated_at = now()
FROM public.product_collections c, collapse_targets t
WHERE c.id = p.collection_id AND c.id = t.collection_id;
