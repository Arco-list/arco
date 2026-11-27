-- Fitness: Pilates & yoga als soort (reformers, matten — Balanced Body), tussen
-- Krachttraining en Fitnessaccessoires.
insert into public.product_categories (slug, name, name_nl, parent_id, order_index, is_active)
select 'pilates-yoga', 'Pilates & yoga', 'Pilates & yoga', id, 3, true
from public.product_categories where slug = 'fitness'
on conflict (slug) do nothing;

update public.product_categories c set order_index = v.ord
from (values ('cardio-equipment', 1), ('strength-equipment', 2), ('pilates-yoga', 3), ('fitness-accessories', 4)) v(slug, ord)
where c.slug = v.slug;
