-- Migration: Add transactional RPC for feature photo assignment
-- Issue: Photo assignment to features lacks transaction safety, leading to potential
--        inconsistencies if partial operations fail
-- Solution: Single RPC function with ACID guarantees for all photo assignment operations

CREATE OR REPLACE FUNCTION public.assign_feature_photos(
  p_project_id uuid,
  p_feature_id uuid,
  p_add_photo_ids uuid[],
  p_remove_photo_ids uuid[],
  p_fallback_feature_id uuid,
  p_cover_photo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_updated_count int;
  v_removed_count int;
BEGIN
  -- Verify the user owns this project
  IF NOT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
      AND client_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this project';
  END IF;

  -- Verify the feature belongs to this project
  IF NOT EXISTS (
    SELECT 1 FROM project_features
    WHERE id = p_feature_id
      AND project_id = p_project_id
  ) THEN
    RAISE EXCEPTION 'Invalid feature: Feature does not belong to this project';
  END IF;

  -- Start transaction (implicit in function, but explicit for clarity)

  -- Step 1: Assign photos to the feature
  IF p_add_photo_ids IS NOT NULL AND array_length(p_add_photo_ids, 1) > 0 THEN
    UPDATE project_photos
    SET feature_id = p_feature_id,
        updated_at = now()
    WHERE id = ANY(p_add_photo_ids)
      AND project_id = p_project_id; -- Safety check

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  ELSE
    v_updated_count := 0;
  END IF;

  -- Step 2: Unassign removed photos (move to fallback feature)
  IF p_remove_photo_ids IS NOT NULL AND array_length(p_remove_photo_ids, 1) > 0 THEN
    UPDATE project_photos
    SET feature_id = p_fallback_feature_id,
        updated_at = now()
    WHERE id = ANY(p_remove_photo_ids)
      AND project_id = p_project_id; -- Safety check

    GET DIAGNOSTICS v_removed_count = ROW_COUNT;
  ELSE
    v_removed_count := 0;
  END IF;

  -- Step 3: Update cover photo for the feature
  UPDATE project_features
  SET cover_photo_id = p_cover_photo_id,
      updated_at = now()
  WHERE id = p_feature_id
    AND project_id = p_project_id; -- Safety check

  -- Verify cover photo belongs to the feature (if not null)
  IF p_cover_photo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM project_photos
    WHERE id = p_cover_photo_id
      AND feature_id = p_feature_id
  ) THEN
    RAISE EXCEPTION 'Invalid cover photo: Photo does not belong to this feature';
  END IF;

  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'photos_assigned', v_updated_count,
    'photos_removed', v_removed_count,
    'cover_photo_id', p_cover_photo_id
  );

  RETURN v_result;

  -- If any error occurs, entire transaction rolls back automatically
EXCEPTION
  WHEN OTHERS THEN
    RAISE; -- Re-raise the exception after rollback
END;
$$;

COMMENT ON FUNCTION public.assign_feature_photos IS
'Transactionally assigns photos to project features with ACID guarantees.
All operations succeed or fail together, preventing partial state corruption.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.assign_feature_photos TO authenticated;
