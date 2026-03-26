-- Add image_url column to spaces table for homepage display
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS image_url text;

-- Remove dining-room space (merged into kitchen/living)
DELETE FROM public.spaces WHERE slug = 'dining-room';
