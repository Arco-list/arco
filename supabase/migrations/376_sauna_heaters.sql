-- Wellness › Sauna & stoom › Saunakachels: een eigen product, vaak van een
-- eigen merk (Harvia, Tylö, EOS) en in een saunafoto goed te herkennen.
-- Na Sauna's; de rest schuift een plaats op.

update public.product_categories set order_index = order_index + 1
where parent_id = (select id from public.product_categories where slug = 'sauna-steam') and order_index >= 2;

insert into public.product_categories (slug, name, name_nl, parent_id, order_index, is_active)
select 'sauna-heaters', 'Sauna heaters', 'Saunakachels', id, 2, true
from public.product_categories where slug = 'sauna-steam'
on conflict (slug) do nothing;
