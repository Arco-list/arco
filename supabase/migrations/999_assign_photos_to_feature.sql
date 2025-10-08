-- Create a helper function to assign multiple photos to a feature atomically
-- Ensures all photo IDs belong to the project before updating, otherwise raises an exception

CREATE OR REPLACE FUNCTION public.assign_photos_to_feature(
  p_project_id uuid,
  p_feature_id uuid,
  p_photo_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  photo_count integer;
  matched_count integer;
  request_user uuid;
BEGIN
  IF p_photo_ids IS NULL OR array_length(p_photo_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO photo_count FROM unnest(p_photo_ids);

  SELECT COUNT(*) INTO matched_count
  FROM public.project_photos
  WHERE project_id = p_project_id
    AND id = ANY(p_photo_ids);

  IF photo_count != matched_count THEN
    RAISE EXCEPTION 'Some photos do not belong to the specified project';
  END IF;

  PERFORM 1
  FROM public.project_features
  WHERE id = p_feature_id
    AND project_id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature does not belong to the specified project';
  END IF;

  request_user := NULL;
  BEGIN
    request_user := current_setting('request.jwt.claim.sub', true)::uuid;
  EXCEPTION
    WHEN others THEN
      request_user := NULL;
  END;

  IF request_user IS NOT NULL THEN
    PERFORM 1
    FROM public.projects
    WHERE id = p_project_id
      AND client_id = request_user;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'You are not authorized to modify this project';
    END IF;
  END IF;

  UPDATE public.project_photos
  SET feature_id = p_feature_id
  WHERE project_id = p_project_id
    AND id = ANY(p_photo_ids);
END;
$function$;
