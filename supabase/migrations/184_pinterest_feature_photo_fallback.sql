-- Broaden the feature-eligibility check on pinterest triggers.
--
-- Previous behaviour only enqueued a feature pin when project_features
-- .cover_photo_id was set. Most secondary spaces (Pool, Garden, Terrace)
-- never had a designer explicitly promote one photo as cover — the
-- photos are attached to the feature via project_photos.feature_id but
-- no cover was designated, so the pin never got created.
--
-- New behaviour: a feature is eligible whenever it has any photo
-- attached (either an explicit cover_photo_id OR at least one row in
-- project_photos with matching feature_id). The workflow itself already
-- falls back to the first-order photo when cover_photo_id is null.

CREATE OR REPLACE FUNCTION public.pinterest_trg_projects_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  went_public boolean := (NEW.status = 'published' AND (OLD.status IS DISTINCT FROM 'published'));
  went_private boolean := (OLD.status = 'published' AND (NEW.status IS DISTINCT FROM 'published'));
  fid uuid;
BEGIN
  IF went_public THEN
    PERFORM public.pinterest_enqueue('project', NEW.id, 'publish');
    FOR fid IN
      SELECT pf.id
      FROM public.project_features pf
      LEFT JOIN public.spaces s ON s.id = pf.space_id
      WHERE pf.project_id = NEW.id
        AND (
          pf.cover_photo_id IS NOT NULL
          OR EXISTS (SELECT 1 FROM public.project_photos pp WHERE pp.feature_id = pf.id)
        )
        AND (s.slug IS NULL OR s.slug <> 'exterior')
    LOOP
      PERFORM public.pinterest_enqueue('feature', fid, 'publish');
    END LOOP;
  ELSIF went_private THEN
    IF NEW.pinterest_pin_id IS NOT NULL THEN
      PERFORM public.pinterest_enqueue('project', NEW.id, 'delete');
    END IF;
    FOR fid IN
      SELECT id FROM public.project_features WHERE project_id = NEW.id AND pinterest_pin_id IS NOT NULL
    LOOP
      PERFORM public.pinterest_enqueue('feature', fid, 'delete');
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.pinterest_trg_features()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  project_published boolean;
  space_slug text;
  eligible boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.pinterest_pin_id IS NOT NULL THEN
      PERFORM public.pinterest_enqueue('feature', OLD.id, 'delete');
    END IF;
    RETURN OLD;
  END IF;

  SELECT (status = 'published') INTO project_published FROM public.projects WHERE id = NEW.project_id;
  IF NOT project_published THEN RETURN NEW; END IF;

  SELECT slug INTO space_slug FROM public.spaces WHERE id = NEW.space_id;
  eligible := (
    NEW.cover_photo_id IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.project_photos pp WHERE pp.feature_id = NEW.id)
  ) AND (space_slug IS NULL OR space_slug <> 'exterior');

  IF TG_OP = 'INSERT' THEN
    IF eligible THEN
      PERFORM public.pinterest_enqueue('feature', NEW.id, 'publish');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.cover_photo_id IS DISTINCT FROM OLD.cover_photo_id OR NEW.space_id IS DISTINCT FROM OLD.space_id THEN
    IF OLD.pinterest_pin_id IS NOT NULL THEN
      PERFORM public.pinterest_enqueue('feature', NEW.id, 'delete');
    END IF;
    IF eligible THEN
      PERFORM public.pinterest_enqueue('feature', NEW.id, 'publish');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
