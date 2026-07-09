-- Bucket for pre-generated Pinterest + social share images.
--
-- Public read so Pinterest's crawler can fetch pin images by URL and
-- so the project detail page can surface the og:image without a signed
-- URL round-trip. Writes are service-role only (the cron worker uploads
-- through the service key).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pinterest-media',
  'pinterest-media',
  true,
  5 * 1024 * 1024,  -- 5 MB per image is more than enough for JPEG q82
  ARRAY['image/jpeg']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Anonymous read of any object in this bucket. Same shape as the
-- existing project-photos policy.
CREATE POLICY pinterest_media_public_read
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'pinterest-media');
