-- Migration: Update project categories sort order
-- Description: Reorder project categories to match the requested sequence: House, Kitchen & Living, Bed & Bath, Outdoor, Other

-- Update sort order for project categories
UPDATE public.categories 
SET sort_order = CASE 
  WHEN name = 'House' THEN 1
  WHEN name = 'Kitchen & Living' THEN 2
  WHEN name = 'Bed & Bath' THEN 3
  WHEN name = 'Outdoor' THEN 4
  WHEN name = 'Other' THEN 5
  ELSE sort_order
END
WHERE name IN ('House', 'Kitchen & Living', 'Bed & Bath', 'Outdoor', 'Other')
  AND parent_id IS NULL;

-- Add comment
COMMENT ON TABLE public.categories IS 'Service categories and project types - Updated sort order for project categories';
