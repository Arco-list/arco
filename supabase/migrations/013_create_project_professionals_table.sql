-- Migration: Create project_professionals table
-- Description: Tracks professional invitations/status per project.

DO $$
BEGIN
  CREATE TYPE public.professional_project_status AS ENUM (
    'invited',
    'listed',
    'live_on_page',
    'unlisted',
    'rejected',
    'removed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE public.project_professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invited_service_category_id uuid REFERENCES public.categories(id),
  status public.professional_project_status NOT NULL DEFAULT 'invited',
  is_project_owner boolean NOT NULL DEFAULT false,
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT project_professionals_unique_invite
    UNIQUE (project_id, invited_email, invited_service_category_id)
);

CREATE INDEX idx_project_professionals_project ON public.project_professionals(project_id);
CREATE INDEX idx_project_professionals_professional ON public.project_professionals(professional_id);
CREATE INDEX idx_project_professionals_email ON public.project_professionals(invited_email);

COMMENT ON TABLE public.project_professionals IS 'Professionals invited to or associated with a project listing';
COMMENT ON COLUMN public.project_professionals.is_project_owner IS 'True for the company that owns the listing';

ALTER TABLE public.project_professionals ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER handle_project_professionals_updated_at
  BEFORE UPDATE ON public.project_professionals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
