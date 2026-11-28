-- Occhio: de oude kleine foto's weg (teasers van 445 px en Drupal-varianten
-- van 320 px), nu de productpagina's grote foto's hebben opgeleverd. Alleen
-- in collecties met minstens drie foto's van 1000 px of meer, en nooit de
-- omslag. Collecties met minder grote foto's houden alles.

delete from public.product_collection_photos ph
where ph.collection_id in (
    select p.collection_id
    from public.product_collection_photos p
    join public.product_collections pc on pc.id = p.collection_id
    join public.brands b on b.id = pc.brand_id
    where b.name = 'Occhio' and greatest(coalesce(p.width, 0), coalesce(p.height, 0)) >= 1000
    group by p.collection_id
    having count(*) >= 3)
  and not ph.is_primary
  and greatest(coalesce(ph.width, 0), coalesce(ph.height, 0)) < 1000;
