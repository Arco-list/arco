-- Migration: One company per project
-- Change invited_service_category_id (single UUID) to invited_service_category_ids (UUID array)
-- Enforce one row per (project, email) instead of (project, email, service)

-- 1. Add array column
ALTER TABLE project_professionals
  ADD COLUMN IF NOT EXISTS invited_service_category_ids uuid[] DEFAULT '{}';

-- 2. Migrate existing data: copy single ID into array
UPDATE project_professionals
SET invited_service_category_ids = ARRAY[invited_service_category_id]
WHERE invited_service_category_id IS NOT NULL
  AND (invited_service_category_ids IS NULL OR cardinality(invited_service_category_ids) = 0);

-- 3. Merge duplicate rows (same project + email, different services)
-- Keep the row that is_project_owner or has earliest invited_at
WITH ranked AS (
  SELECT id, project_id, invited_email,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, invited_email
      ORDER BY is_project_owner DESC, invited_at ASC
    ) AS rn
  FROM project_professionals
),
merged_services AS (
  SELECT project_id, invited_email,
    array_agg(DISTINCT svc) FILTER (WHERE svc IS NOT NULL) AS all_services
  FROM project_professionals, unnest(invited_service_category_ids) AS svc
  GROUP BY project_id, invited_email
)
UPDATE project_professionals pp
SET invited_service_category_ids = COALESCE(ms.all_services, '{}')
FROM ranked r
LEFT JOIN merged_services ms
  ON ms.project_id = r.project_id AND ms.invited_email = r.invited_email
WHERE pp.id = r.id AND r.rn = 1;

-- 4. Delete duplicate rows (keep only rn=1)
DELETE FROM project_professionals
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY project_id, invited_email
        ORDER BY is_project_owner DESC, invited_at ASC
      ) AS rn
    FROM project_professionals
  ) sub WHERE rn > 1
);

-- 5. Drop old column and constraints
ALTER TABLE project_professionals
  DROP CONSTRAINT IF EXISTS project_professionals_unique_invite;
ALTER TABLE project_professionals
  DROP CONSTRAINT IF EXISTS project_professionals_invited_service_category_id_fkey;
ALTER TABLE project_professionals
  DROP COLUMN IF EXISTS invited_service_category_id;

-- 6. Add new unique constraint
ALTER TABLE project_professionals
  ADD CONSTRAINT project_professionals_unique_per_project
  UNIQUE (project_id, invited_email);
