-- Add can_publish_projects flag to professional service categories
-- When enabled, companies with this service can publish projects
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS can_publish_projects boolean NOT NULL DEFAULT false;

-- Enable for common project-publishing services (Architects, Interior Designers, etc.)
-- This can be toggled per-service in the admin categories panel.
COMMENT ON COLUMN categories.can_publish_projects IS 'Whether companies offering this professional service are allowed to publish projects';
