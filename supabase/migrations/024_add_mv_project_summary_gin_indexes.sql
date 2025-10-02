-- Migration: Add GIN indexes on mv_project_summary arrays
-- Description: Supports fast array containment filters for styles and features

BEGIN;

CREATE INDEX IF NOT EXISTS idx_mv_project_summary_style_preferences_gin
  ON public.mv_project_summary USING gin(style_preferences);

CREATE INDEX IF NOT EXISTS idx_mv_project_summary_features_gin
  ON public.mv_project_summary USING gin(features);

COMMIT;
