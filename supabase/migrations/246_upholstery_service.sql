-- Upholstery as its own service under Finishing.
--
-- It sat nowhere: a stoffeerder is not a meubelmaker (who builds the
-- frame) and not an interieurstylist (who chooses the piece), so the
-- trade had to be credited under a neighbouring service or not at all.
-- Sort order 56 was the free slot between Fireplaces (55) and Furniture
-- (57), which puts it with the two services it is most often confused
-- with rather than at the end of the list.
--
-- Everything else mirrors its siblings: a homeowner-facing professional
-- service that cannot publish projects of its own.

insert into public.categories (name, name_nl, slug, parent_id, sort_order, category_hierarchy, category_type, icon, audience, can_publish_projects, is_active)
select
  'Upholstery',
  'Stoffering',
  'upholstery',
  p.id,
  56,
  2,
  'Professional',
  'armchair',
  'homeowner',
  false,
  true
from public.categories p
where p.slug = 'finishing'
  and not exists (select 1 from public.categories c where c.slug = 'upholstery');
