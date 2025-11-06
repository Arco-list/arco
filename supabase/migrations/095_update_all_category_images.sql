-- Enhanced migration to add image URLs to ALL parent categories
-- This builds upon migration 094 by adding images for the remaining categories

-- Ensure the image_url column exists (in case this is run standalone)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Update the core 5 parent categories (from original migration 094)
UPDATE categories SET image_url = '/professional-architect-working-on-blueprints.jpg'
WHERE slug = 'design-planning' AND parent_id IS NULL;

UPDATE categories SET image_url = '/construction-manager-at-building-site.jpg'
WHERE slug = 'construction' AND parent_id IS NULL;

UPDATE categories SET image_url = '/structural-engineer-working-on-technical-drawings.jpg'
WHERE slug = 'systems' AND parent_id IS NULL;

UPDATE categories SET image_url = '/interior-designer-working-on-modern-room-design.jpg'
WHERE slug = 'finishing' AND parent_id IS NULL;

UPDATE categories SET image_url = '/landscape-designer-working-in-beautiful-garden.jpg'
WHERE slug = 'outdoor' AND parent_id IS NULL;

-- Additional parent categories with appropriate image mappings
UPDATE categories SET image_url = '/bathroom-vanity-with-mirror.jpg'
WHERE slug = 'bathroom-design' AND parent_id IS NULL;

UPDATE categories SET image_url = '/bedroom-storage-solutions.jpg'
WHERE slug = 'bed-bath' AND parent_id IS NULL;

UPDATE categories SET image_url = '/construction-manager-site.jpg'
WHERE slug = 'commercial' AND parent_id IS NULL;

UPDATE categories SET image_url = '/engineering-blueprints.jpg'
WHERE slug = 'home-automation' AND parent_id IS NULL;

UPDATE categories SET image_url = '/architect-working-on-blueprints.jpg'
WHERE slug = 'house' AND parent_id IS NULL;

UPDATE categories SET image_url = '/interior-design-modern.jpg'
WHERE slug = 'interior-design' AND parent_id IS NULL;

UPDATE categories SET image_url = '/kitchen-dining-area.jpg'
WHERE slug = 'kitchen-living' AND parent_id IS NULL;

UPDATE categories SET image_url = '/kitchen-cabinets-and-appliances.jpg'
WHERE slug = 'kitchen-design' AND parent_id IS NULL;

UPDATE categories SET image_url = '/landscape-garden-design.jpg'
WHERE slug = 'landscaping' AND parent_id IS NULL;

UPDATE categories SET image_url = '/dining-area-with-large-windows.jpg'
WHERE slug = 'lighting-design' AND parent_id IS NULL;

UPDATE categories SET image_url = '/project-management-construction.jpg'
WHERE slug = 'new-construction' AND parent_id IS NULL;

UPDATE categories SET image_url = '/placeholder.jpg'
WHERE slug = 'other' AND parent_id IS NULL;

UPDATE categories SET image_url = '/project-management-construction.jpg'
WHERE slug = 'renovation' AND parent_id IS NULL;

UPDATE categories SET image_url = '/dining-area-with-large-windows.jpg'
WHERE slug = 'residential' AND parent_id IS NULL;

-- Note: 'Systems' category already covered in core 5 above
