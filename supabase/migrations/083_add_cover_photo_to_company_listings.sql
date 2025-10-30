-- Migration: Add cover photo to mv_company_listings
-- Description: Add cover_photo_url and primary_service_name to company listings view

-- Drop the existing view
DROP MATERIALIZED VIEW IF EXISTS public.mv_company_listings CASCADE;

-- Recreate with cover photo and primary service name
CREATE MATERIALIZED VIEW public.mv_company_listings AS
SELECT
  c.id,
  c.slug,
  c.name,
  c.description,
  c.logo_url,
  c.city,
  c.state_region,
  c.country,
  c.domain,
  c.status,
  c.plan_tier,
  c.plan_expires_at,
  c.is_featured,
  c.services_offered,
  c.languages,
  c.team_size_min,
  c.team_size_max,
  c.founded_year,
  c.created_at,
  c.updated_at,
  -- Ratings from company_ratings
  COALESCE(cr.overall_rating, 0) as display_rating,
  COALESCE(cr.total_reviews, 0) as total_reviews,
  COALESCE(cr.quality_rating, 0) as quality_rating,
  COALESCE(cr.reliability_rating, 0) as reliability_rating,
  COALESCE(cr.communication_rating, 0) as communication_rating,
  cr.last_review_at,
  -- Get first professional's data (for backward compatibility with UI)
  (
    SELECT p.title
    FROM public.professionals p
    WHERE p.company_id = c.id AND p.is_available = TRUE
    ORDER BY p.created_at ASC
    LIMIT 1
  ) as professional_title,
  (
    SELECT prof.first_name
    FROM public.professionals p
    JOIN public.profiles prof ON p.user_id = prof.id
    WHERE p.company_id = c.id AND p.is_available = TRUE
    ORDER BY p.created_at ASC
    LIMIT 1
  ) as first_name,
  (
    SELECT prof.last_name
    FROM public.professionals p
    JOIN public.profiles prof ON p.user_id = prof.id
    WHERE p.company_id = c.id AND p.is_available = TRUE
    ORDER BY p.created_at ASC
    LIMIT 1
  ) as last_name,
  (
    SELECT prof.avatar_url
    FROM public.professionals p
    JOIN public.profiles prof ON p.user_id = prof.id
    WHERE p.company_id = c.id AND p.is_available = TRUE
    ORDER BY p.created_at ASC
    LIMIT 1
  ) as avatar_url,
  (
    SELECT prof.location
    FROM public.professionals p
    JOIN public.profiles prof ON p.user_id = prof.id
    WHERE p.company_id = c.id AND p.is_available = TRUE
    ORDER BY p.created_at ASC
    LIMIT 1
  ) as user_location,
  -- Check if company has any available professionals
  EXISTS(
    SELECT 1 FROM public.professionals p
    WHERE p.company_id = c.id AND p.is_available = TRUE
  ) as has_available_professionals,
  -- Check if company has any verified professionals
  EXISTS(
    SELECT 1 FROM public.professionals p
    WHERE p.company_id = c.id AND p.is_verified = TRUE
  ) as is_verified,
  -- Searchable location fields
  LOWER(TRIM(COALESCE(c.country, ''))) as searchable_country,
  LOWER(TRIM(COALESCE(c.state_region, ''))) as searchable_state_region,
  LOWER(TRIM(COALESCE(c.city, ''))) as searchable_city,
  -- Primary service (first service offered)
  CASE
    WHEN c.services_offered IS NOT NULL AND array_length(c.services_offered, 1) > 0
    THEN c.services_offered[1]
    ELSE NULL
  END as primary_service,
  -- Service category IDs from professionals
  (
    SELECT ARRAY_AGG(DISTINCT ps.category_id)
    FROM public.professionals p
    JOIN public.professional_specialties ps ON p.id = ps.professional_id
    WHERE p.company_id = c.id
  ) as specialty_ids,
  -- Parent category IDs
  (
    SELECT ARRAY_AGG(DISTINCT cat.parent_id)
    FROM public.professionals p
    JOIN public.professional_specialties ps ON p.id = ps.professional_id
    JOIN public.categories cat ON ps.category_id = cat.id
    WHERE p.company_id = c.id AND cat.parent_id IS NOT NULL
  ) as specialty_parent_ids,
  -- Cover photo URL (first photo marked as cover, or first photo if no cover marked)
  (
    SELECT COALESCE(
      (SELECT url FROM public.company_photos WHERE company_id = c.id AND is_cover = TRUE ORDER BY order_index LIMIT 1),
      (SELECT url FROM public.company_photos WHERE company_id = c.id ORDER BY order_index LIMIT 1)
    )
  ) as cover_photo_url,
  -- Primary service name (services_offered already contains names, not UUIDs)
  (
    CASE
      WHEN c.services_offered IS NOT NULL AND array_length(c.services_offered, 1) > 0 THEN
        c.services_offered[1]
      ELSE NULL
    END
  ) as primary_service_name
FROM public.companies c
LEFT JOIN public.company_ratings cr ON c.id = cr.company_id
WHERE c.status = 'listed';

-- Create indexes
CREATE UNIQUE INDEX mv_company_listings_id_idx ON public.mv_company_listings (id);
CREATE INDEX mv_company_listings_slug_idx ON public.mv_company_listings (slug);
CREATE INDEX mv_company_listings_status_idx ON public.mv_company_listings (status);
CREATE INDEX mv_company_listings_plan_tier_idx ON public.mv_company_listings (plan_tier);
CREATE INDEX mv_company_listings_rating_idx ON public.mv_company_listings (display_rating DESC);
CREATE INDEX mv_company_listings_featured_idx ON public.mv_company_listings (is_featured) WHERE is_featured = true;
CREATE INDEX mv_company_listings_location_idx ON public.mv_company_listings (searchable_country, searchable_state_region, searchable_city);
CREATE INDEX mv_company_listings_specialty_idx ON public.mv_company_listings USING GIN (specialty_ids);

-- Grant permissions
GRANT SELECT ON public.mv_company_listings TO anon;
GRANT SELECT ON public.mv_company_listings TO authenticated;

-- Refresh the view
REFRESH MATERIALIZED VIEW public.mv_company_listings;
