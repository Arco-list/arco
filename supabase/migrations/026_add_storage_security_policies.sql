-- Migration: Add storage bucket security policies and restrictions
-- Description: Secure company-assets bucket with RLS policies and file restrictions

-- Step 1: Update bucket with file size and MIME type restrictions (executed via MCP)
-- UPDATE storage.buckets
-- SET
--   file_size_limit = 5242880,  -- 5MB in bytes
--   allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/svg+xml']
-- WHERE id = 'company-assets';
-- ✅ Applied successfully via mcp__supabase__execute_sql

-- Step 2: Storage RLS policies (already exist from previous setup)
-- The following policies are active on storage.objects:
-- - company_assets_owner_insert: Authenticated users can upload to their company folder
-- - company_assets_public_read: Public read access for all company assets
-- - company_assets_owner_delete: Owners can delete their files
-- - company_assets_owner_update: Owners can update their files

-- Step 3: Add index for performance on companies.owner_id if not exists
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON public.companies(owner_id);

-- Step 4: Add helper function for atomic photo reordering
CREATE OR REPLACE FUNCTION reorder_company_photos(
  photo_ids uuid[],
  company_id_param uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  photo_id uuid;
  idx int;
  arr_length int;
BEGIN
  -- Validate array is not NULL or empty
  arr_length := array_length(photo_ids, 1);

  IF arr_length IS NULL OR arr_length = 0 THEN
    RAISE EXCEPTION 'Photo IDs array cannot be empty';
  END IF;

  -- Verify all photos belong to the company
  IF (
    SELECT COUNT(*)
    FROM company_photos
    WHERE id = ANY(photo_ids)
    AND company_id = company_id_param
  ) != arr_length THEN
    RAISE EXCEPTION 'Invalid photo IDs for company';
  END IF;

  -- Update order indices atomically
  FOR idx IN 1..arr_length LOOP
    photo_id := photo_ids[idx];
    UPDATE company_photos
    SET order_index = idx - 1
    WHERE id = photo_id AND company_id = company_id_param;
  END LOOP;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION reorder_company_photos(uuid[], uuid) TO authenticated;
