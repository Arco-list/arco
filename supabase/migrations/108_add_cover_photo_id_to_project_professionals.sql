-- Add cover_photo_id to project_professionals
-- Allows each company to choose a custom cover image for how a project appears on their portfolio
ALTER TABLE public.project_professionals
  ADD COLUMN cover_photo_id UUID REFERENCES public.project_photos(id) ON DELETE SET NULL;

-- Index for lookups
CREATE INDEX idx_project_professionals_cover_photo ON public.project_professionals(cover_photo_id) WHERE cover_photo_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
