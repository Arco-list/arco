-- Fix the existing photographer category row.
--   • Rename "Photgrapher" → "Photographer" (typo)
--   • Slug photgraphy → photographer
--   • Re-parent from Finishing → Design & Planning, alongside Architect /
--     Interior Designer / Garden designer. Photographers are credited
--     collaborators on a project (like architects), not a finishing trade
--     (like painters or cabinet makers).
--   • Keep can_publish_projects = false (photographers get credited; they
--     don't lead-publish projects).

UPDATE public.categories
SET
  name = 'Photographer',
  slug = 'photographer',
  parent_id = 'd339d74e-18c3-4537-ab38-913a4a13c562'  -- Design & Planning
WHERE id = '4bbf8e95-2c4e-4fce-b907-6e73677c0900';
