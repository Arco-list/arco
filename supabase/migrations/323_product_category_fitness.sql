-- Fitness als vierde subgroep onder Wellness (naast Sauna & stoom, Spa's
-- en Zwembaden), met drie soorten op het derde niveau, zoals de andere
-- subgroepen. Merken als PENT. (fitnessapparatuur voor in huis) horen
-- hier; tot nu toe hingen ze los aan de groep Wellness.

insert into product_categories (slug, name, name_nl, parent_id, order_index, is_active)
select 'fitness', 'Fitness', 'Fitness', w.id, 4, true
from product_categories w
where w.slug = 'wellness' and w.parent_id is null
on conflict (slug) do nothing;

insert into product_categories (slug, name, name_nl, parent_id, order_index, is_active)
select v.slug, v.name, v.name_nl, f.id, v.ord, true
from (values
  ('cardio-equipment',     'Cardio equipment',     'Cardio-apparatuur',   1),
  ('strength-equipment',   'Strength equipment',   'Krachttraining',      2),
  ('fitness-accessories',  'Fitness accessories',  'Fitnessaccessoires',  3)
) as v(slug, name, name_nl, ord)
cross join product_categories f
where f.slug = 'fitness'
on conflict (slug) do nothing;

-- PENT.: van de groep Wellness naar de subgroep Fitness (merken hangen
-- hooguit op subgroepniveau).
delete from brand_categories bc
using brands b, product_categories c
where bc.brand_id = b.id and bc.category_id = c.id
  and b.slug = 'pent' and c.slug = 'wellness';

insert into brand_categories (brand_id, category_id)
select b.id, c.id from brands b, product_categories c
where b.slug = 'pent' and c.slug = 'fitness'
on conflict do nothing;
