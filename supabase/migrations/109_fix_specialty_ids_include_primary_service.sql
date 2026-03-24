-- Fix: specialty_ids and specialty_parent_ids must include primary_service_id
-- Companies like EVE Architecten and BAAS Architecten have primary_service_id set
-- but empty services_offered array, causing them to be invisible to category filters.

-- Drop dependent view first
DROP VIEW IF EXISTS public.professional_search_documents CASCADE;

-- Drop and recreate the materialized view
DROP MATERIALIZED VIEW IF EXISTS public.mv_professional_summary CASCADE;

CREATE MATERIALIZED VIEW public.mv_professional_summary AS
SELECT
  p.id,
  p.user_id,
  p.company_id,
  p.title,
  p.bio,
  p.is_verified,
  p.is_available,
  p.years_experience,
  p.hourly_rate_min,
  p.hourly_rate_max,
  p.portfolio_url,
  p.languages_spoken,

  -- Services offered: combine services_offered array + primary_service_id
  (
    SELECT array_agg(DISTINCT cat.name ORDER BY cat.name)
    FROM (
      SELECT unnest(c.services_offered) AS service_id
      UNION
      SELECT c.primary_service_id::text WHERE c.primary_service_id IS NOT NULL
    ) all_services
    JOIN categories cat ON cat.id::text = all_services.service_id
    WHERE cat.name IS NOT NULL
  ) AS services_offered,

  p.created_at,
  p.updated_at,
  c.id AS company_id_full,
  c.name AS company_name,
  c.slug AS company_slug,
  c.logo_url AS company_logo,
  c.city AS company_city,
  c.state_region AS company_state_region,
  c.country AS company_country,
  c.domain AS company_domain,
  c.status AS company_status,
  c.plan_tier AS company_plan_tier,
  c.plan_expires_at AS company_plan_expires_at,
  c.is_featured AS company_is_featured,
  c.latitude AS company_latitude,
  c.longitude AS company_longitude,

  primary_cat.name AS primary_service_name,

  prof.first_name,
  prof.last_name,
  prof.avatar_url,
  prof.location AS user_location,

  COALESCE(cr.overall_rating, 0::numeric) AS display_rating,
  COALESCE(cr.total_reviews, 0) AS total_reviews,
  COALESCE(cr.quality_rating, 0::numeric) AS quality_rating,
  COALESCE(cr.reliability_rating, 0::numeric) AS reliability_rating,
  COALESCE(cr.communication_rating, 0::numeric) AS communication_rating,
  cr.last_review_at,

  CASE
    WHEN p.hourly_rate_min IS NOT NULL AND p.hourly_rate_max IS NOT NULL
      THEN '€' || p.hourly_rate_min || ' - €' || p.hourly_rate_max || '/hr'
    WHEN p.hourly_rate_min IS NOT NULL
      THEN '€' || p.hourly_rate_min || '/hr'
    WHEN p.hourly_rate_max IS NOT NULL
      THEN '€' || p.hourly_rate_max || '/hr'
    ELSE NULL
  END AS hourly_rate_display,

  lower(trim(COALESCE(c.country, ''))) AS searchable_country,
  lower(trim(COALESCE(c.state_region, ''))) AS searchable_state_region,
  lower(trim(COALESCE(c.city, ''))) AS searchable_city,

  -- Primary specialty name
  COALESCE(
    primary_cat.name,
    (
      SELECT cat_s.name
      FROM unnest(c.services_offered) WITH ORDINALITY t(service_id, idx)
      JOIN categories cat_s ON cat_s.id::text = t.service_id
      WHERE cat_s.parent_id IS NOT NULL
      ORDER BY t.idx
      LIMIT 1
    )
  ) AS primary_specialty,

  -- Primary specialty slug
  COALESCE(
    primary_cat.slug,
    (
      SELECT cat_s.slug
      FROM unnest(c.services_offered) WITH ORDINALITY t(service_id, idx)
      JOIN categories cat_s ON cat_s.id::text = t.service_id
      WHERE cat_s.parent_id IS NOT NULL
      ORDER BY t.idx
      LIMIT 1
    )
  ) AS primary_specialty_slug,

  -- Specialty IDs: all service IDs from services_offered + primary_service_id
  (
    SELECT array_agg(DISTINCT all_ids.service_uuid)
    FROM (
      SELECT cat_s.id AS service_uuid
      FROM unnest(c.services_offered) t(service_id)
      JOIN categories cat_s ON cat_s.id::text = t.service_id
      UNION
      SELECT c.primary_service_id AS service_uuid
      WHERE c.primary_service_id IS NOT NULL
    ) all_ids
  ) AS specialty_ids,

  -- Specialty parent IDs: parent categories from services_offered + primary_service_id
  (
    SELECT array_agg(DISTINCT sub.parent_uuid)
    FROM (
      -- Parents of child services in services_offered
      SELECT cat_s.parent_id AS parent_uuid
      FROM unnest(c.services_offered) t(service_id)
      JOIN categories cat_s ON cat_s.id::text = t.service_id
      WHERE cat_s.parent_id IS NOT NULL
      UNION
      -- Direct parent categories in services_offered
      SELECT cat_s.id AS parent_uuid
      FROM unnest(c.services_offered) t(service_id)
      JOIN categories cat_s ON cat_s.id::text = t.service_id
      WHERE cat_s.parent_id IS NULL
      UNION
      -- Parent of primary_service_id (if it's a child category)
      SELECT cat_p.parent_id AS parent_uuid
      FROM categories cat_p
      WHERE cat_p.id = c.primary_service_id
        AND cat_p.parent_id IS NOT NULL
      UNION
      -- primary_service_id itself (if it's a parent category)
      SELECT cat_p.id AS parent_uuid
      FROM categories cat_p
      WHERE cat_p.id = c.primary_service_id
        AND cat_p.parent_id IS NULL
    ) sub
  ) AS specialty_parent_ids,

  -- Cover photo
  (
    SELECT COALESCE(
      c.hero_photo_url,
      (SELECT url FROM company_photos WHERE company_id = c.id AND is_cover = true ORDER BY order_index LIMIT 1),
      (SELECT url FROM company_photos WHERE company_id = c.id ORDER BY order_index LIMIT 1),
      (SELECT pp.url FROM project_photos pp JOIN project_professionals prp ON pp.project_id = prp.project_id WHERE prp.company_id = c.id ORDER BY pp.is_primary DESC NULLS LAST, pp.order_index LIMIT 1)
    )
  ) AS cover_photo_url

FROM professionals p
JOIN companies c ON p.company_id = c.id
LEFT JOIN categories primary_cat ON c.primary_service_id = primary_cat.id
LEFT JOIN profiles prof ON p.user_id = prof.id
LEFT JOIN company_ratings cr ON c.id = cr.company_id
GROUP BY
  p.id, p.user_id, p.company_id, p.title, p.bio, p.is_verified, p.is_available,
  p.years_experience, p.hourly_rate_min, p.hourly_rate_max, p.portfolio_url,
  p.languages_spoken, p.created_at, p.updated_at,
  c.id, c.name, c.slug, c.logo_url, c.city, c.state_region, c.country, c.domain,
  c.status, c.plan_tier, c.plan_expires_at, c.is_featured, c.services_offered,
  c.hero_photo_url, c.primary_service_id, c.latitude, c.longitude,
  primary_cat.name, primary_cat.slug,
  prof.first_name, prof.last_name, prof.avatar_url, prof.location,
  cr.overall_rating, cr.total_reviews, cr.quality_rating, cr.reliability_rating,
  cr.communication_rating, cr.last_review_at;

-- Recreate unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_mv_professional_summary_id ON mv_professional_summary (id);

-- Recreate the dependent search documents view
CREATE OR REPLACE VIEW public.professional_search_documents AS
SELECT
  p.*,
  to_tsvector('simple',
    trim(
      COALESCE(company_name, '') || ' ' ||
      COALESCE(title, '') || ' ' ||
      COALESCE(bio, '') || ' ' ||
      COALESCE(user_location, '') || ' ' ||
      COALESCE(primary_specialty, '') || ' ' ||
      COALESCE(primary_specialty_slug, '') || ' ' ||
      COALESCE(first_name, '') || ' ' ||
      COALESCE(last_name, '') || ' ' ||
      COALESCE(array_to_string(COALESCE(services_offered, ARRAY[]::text[]), ' '), '') || ' ' ||
      COALESCE(array_to_string(COALESCE(languages_spoken, ARRAY[]::text[]), ' '), '')
    )
  ) AS search_vector
FROM mv_professional_summary p;

-- Refresh the view
REFRESH MATERIALIZED VIEW mv_professional_summary;
