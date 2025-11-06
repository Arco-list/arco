-- Add image_url column to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Update the 5 parent categories with their image URLs
UPDATE categories
SET image_url = '/professional-architect-working-on-blueprints.jpg'
WHERE slug = 'design-planning' AND parent_id IS NULL;

UPDATE categories
SET image_url = '/construction-manager-at-building-site.jpg'
WHERE slug = 'construction' AND parent_id IS NULL;

UPDATE categories
SET image_url = '/structural-engineer-working-on-technical-drawings.jpg'
WHERE slug = 'systems' AND parent_id IS NULL;

UPDATE categories
SET image_url = '/interior-designer-working-on-modern-room-design.jpg'
WHERE slug = 'finishing' AND parent_id IS NULL;

UPDATE categories
SET image_url = '/landscape-designer-working-in-beautiful-garden.jpg'
WHERE slug = 'outdoor' AND parent_id IS NULL;
