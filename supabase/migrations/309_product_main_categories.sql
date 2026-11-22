-- Negen hoofdcategorieën voor producten en merken.
--
-- Nieuw: Wellness, Decor en Construction. Spa's & sauna's verhuist van
-- Outdoor naar Wellness (een sauna staat vaak binnen; Wellness is ook al
-- een ruimte en een professionalcategorie). Zwembaden blijft onder Outdoor.
-- Office en Lifestyle bestaan bewust niet: het eerste is een gebruik, het
-- tweede een restcategorie.
--
-- Volgorde: Furniture, Lighting, Kitchen, Bathroom, Wellness, Outdoor,
-- Decor, Finishes, Construction.

insert into public.product_categories (slug, name, name_nl, parent_id, order_index)
select v.slug, v.name, v.name_nl, null, v.ord
from (values
  ('wellness',     'Wellness',     'Wellness',   5),
  ('decor',        'Decor',        'Decor',      7),
  ('construction', 'Construction', 'Constructie', 9)
) as v(slug, name, name_nl, ord)
where not exists (select 1 from public.product_categories c where c.slug = v.slug);

update public.product_categories set order_index = 6 where slug = 'outdoor'   and parent_id is null;
update public.product_categories set order_index = 8 where slug = 'finishes'  and parent_id is null;

update public.product_categories
set parent_id = (select id from public.product_categories where slug = 'wellness' and parent_id is null),
    order_index = 1
where slug = 'spas-saunas';
