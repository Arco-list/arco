-- Deleting a photo that is a room's cover was rejected by this FK
-- (NO ACTION), so the photo silently reappeared in the editor. The
-- client clears the cover first, but only when its local cover state is
-- in sync — reorders write a new cover server-side without updating it.
-- SET NULL makes deletion safe regardless of client state; the editor
-- falls back to the room's first photo when no cover is set.
-- project_professionals.cover_photo_id already behaves this way.
ALTER TABLE public.project_features
  DROP CONSTRAINT IF EXISTS project_features_cover_photo_id_fkey;

ALTER TABLE public.project_features
  ADD CONSTRAINT project_features_cover_photo_id_fkey
  FOREIGN KEY (cover_photo_id) REFERENCES public.project_photos(id) ON DELETE SET NULL;
