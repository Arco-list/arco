-- Migration 096: Remove completed status from projects
-- This migration removes the 'completed' status which is redundant with
-- the per-company 'live_on_page' status in project_professionals table

-- Step 1: Convert all existing 'completed' projects to 'published'
UPDATE projects
SET status = 'published'
WHERE status = 'completed';

-- Step 2: Remove 'completed' from the project_status enum
ALTER TYPE project_status RENAME TO project_status_old;

CREATE TYPE project_status AS ENUM (
  'draft',
  'in_progress',
  'published',
  'archived',
  'rejected'
);

-- Step 3: Update the projects table to use the new enum
ALTER TABLE projects
  ALTER COLUMN status TYPE project_status
  USING status::text::project_status;

-- Step 4: Drop the old enum type
DROP TYPE project_status_old;

-- Step 5: Update materialized view to only include 'published' status
-- (Refresh will pick up the new definition)
DROP MATERIALIZED VIEW IF EXISTS mv_project_summary;

CREATE MATERIALIZED VIEW mv_project_summary AS
SELECT
  p.id,
  p.title,
  p.description,
  p.status,
  p.client_id,
  p.budget_level,
  p.city,
  p.state,
  p.country,
  p.created_at,
  p.updated_at,
  p.is_featured,
  COALESCE(
    (SELECT json_agg(pc.category_id)
     FROM project_categories pc
     WHERE pc.project_id = p.id),
    '[]'::json
  ) AS category_ids,
  COALESCE(
    (SELECT json_agg(json_build_object(
      'id', pp.id,
      'url', pp.storage_path,
      'width', pp.width,
      'height', pp.height,
      'is_primary', pp.is_primary
    ) ORDER BY pp.is_primary DESC, pp.created_at ASC)
     FROM project_photos pp
     WHERE pp.project_id = p.id),
    '[]'::json
  ) AS photos,
  COALESCE(pl.likes_count, 0) AS likes_count,
  COALESCE(
    (SELECT json_agg(DISTINCT prof.company_id)
     FROM project_professionals prof
     WHERE prof.project_id = p.id
       AND prof.status IN ('live_on_page', 'listed')
       AND prof.is_active = TRUE),
    '[]'::json
  ) AS company_ids
FROM projects p
LEFT JOIN (
  SELECT project_id, COUNT(*) AS likes_count
  FROM project_likes
  GROUP BY project_id
) pl ON pl.project_id = p.id
WHERE p.status = 'published'  -- Only published (completed no longer exists)
  AND EXISTS (
    SELECT 1
    FROM project_professionals prof
    WHERE prof.project_id = p.id
      AND prof.is_active = TRUE
  );

-- Create indexes on the materialized view
CREATE UNIQUE INDEX idx_mv_project_summary_id ON mv_project_summary(id);
CREATE INDEX idx_mv_project_summary_status ON mv_project_summary(status);
CREATE INDEX idx_mv_project_summary_client ON mv_project_summary(client_id);
CREATE INDEX idx_mv_project_summary_created ON mv_project_summary(created_at DESC);
CREATE INDEX idx_mv_project_summary_budget ON mv_project_summary(budget_level);
CREATE INDEX idx_mv_project_summary_location ON mv_project_summary(city, state, country);
CREATE INDEX idx_mv_project_summary_featured ON mv_project_summary(is_featured) WHERE is_featured = true;

-- GIN indexes for array columns
CREATE INDEX idx_mv_project_summary_categories_gin ON mv_project_summary USING gin((category_ids::jsonb));
CREATE INDEX idx_mv_project_summary_companies_gin ON mv_project_summary USING gin((company_ids::jsonb));

COMMENT ON MATERIALIZED VIEW mv_project_summary IS 'Optimized view for project listings - only includes published projects';
