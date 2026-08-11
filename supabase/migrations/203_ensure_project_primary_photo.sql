-- 203: A project with photos always has a primary photo
--
-- mv_project_summary (and everything else that renders a project cover)
-- picks the photo via is_primary = true. Three published projects were
-- found with photos but NO primary flagged — they rendered cover-less
-- and dropped off company pages entirely (the ARHK "only 3 projects"
-- bug). The photo flows can strip the flag (deleting or reordering the
-- primary without promoting a successor), so enforce the AT-LEAST-ONE
-- half of the invariant in the database.
--
-- The EXACTLY-ONE half already exists: the ensure_single_primary_photo
-- trigger demotes siblings whenever a photo is flagged primary. This
-- guard deliberately does NOT duplicate that — and it must not react to
-- that trigger's cascade updates either: the demotion pass briefly
-- leaves the project with no primary mid-statement, and promoting at
-- that moment recurses forever against the demoter (observed as a
-- stack-depth blowout). pg_trigger_depth() = 1 restricts the guard to
-- top-level, user-issued changes.

CREATE OR REPLACE FUNCTION public.promote_first_project_photo(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_project_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.project_photos WHERE project_id = p_project_id)
     AND NOT EXISTS (SELECT 1 FROM public.project_photos WHERE project_id = p_project_id AND is_primary) THEN
    UPDATE public.project_photos
    SET is_primary = true
    WHERE id = (
      SELECT id FROM public.project_photos
      WHERE project_id = p_project_id
      ORDER BY order_index ASC NULLS LAST, created_at ASC
      LIMIT 1
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_project_photos_primary_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only react to top-level changes. Depth > 1 means another trigger's
  -- cascade (ensure_single_primary_photo's sibling demotion, or our own
  -- promote) is mid-flight — acting there recurses.
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  -- A photo moved between projects can strip the OLD project's primary.
  IF TG_OP = 'UPDATE' AND OLD.project_id IS DISTINCT FROM NEW.project_id THEN
    PERFORM public.promote_first_project_photo(OLD.project_id);
  END IF;

  -- Whatever just happened (insert without flag, delete of the primary,
  -- primary unset), leave the project with a primary as long as it has
  -- photos.
  PERFORM public.promote_first_project_photo(COALESCE(NEW.project_id, OLD.project_id));

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_photos_primary_guard ON public.project_photos;
CREATE TRIGGER trg_project_photos_primary_guard
AFTER INSERT OR DELETE OR UPDATE OF is_primary, project_id ON public.project_photos
FOR EACH ROW EXECUTE FUNCTION public.trg_project_photos_primary_guard();

-- Backfill safety net (no-ops in prod — the three broken projects were
-- fixed by hand on Aug 11, but this keeps the migration self-contained
-- for any environment where they weren't).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ph.project_id
    FROM public.project_photos ph
    WHERE NOT EXISTS (
      SELECT 1 FROM public.project_photos p2
      WHERE p2.project_id = ph.project_id AND p2.is_primary
    )
  LOOP
    PERFORM public.promote_first_project_photo(r.project_id);
  END LOOP;
END;
$$;
