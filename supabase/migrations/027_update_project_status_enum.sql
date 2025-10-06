-- Migration: Extend project status enum and track status metadata
-- Description: Adds rejected status and audit fields for project status updates

-- Add the rejected value to the project_status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'rejected'
      AND enumtypid = 'project_status'::regtype
  ) THEN
    ALTER TYPE project_status ADD VALUE 'rejected';
  END IF;
END$$;

-- Track status metadata directly on projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.projects.rejection_reason IS 'Admin-provided explanation when a project is set to rejected status.';
COMMENT ON COLUMN public.projects.status_updated_at IS 'Timestamp of the last status change performed by an admin.';
COMMENT ON COLUMN public.projects.status_updated_by IS 'Profile id of the user who performed the most recent status change.';

-- Add index on status_updated_by for efficient joins
CREATE INDEX IF NOT EXISTS idx_projects_status_updated_by ON public.projects(status_updated_by);
