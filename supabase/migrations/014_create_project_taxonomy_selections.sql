-- Migration: Create project_taxonomy_selections table
-- Description: Normalized storage for wizard taxonomy selections (location/material/etc.).

CREATE TABLE public.project_taxonomy_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  taxonomy_option_id uuid NOT NULL REFERENCES public.project_taxonomy_options(id) ON DELETE CASCADE,
  notes jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT project_taxonomy_selections_unique UNIQUE (project_id, taxonomy_option_id)
);

CREATE INDEX idx_project_taxonomy_selections_project_id
  ON public.project_taxonomy_selections(project_id);

CREATE INDEX idx_project_taxonomy_selections_option_id
  ON public.project_taxonomy_selections(taxonomy_option_id);

ALTER TABLE public.project_taxonomy_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_taxonomy_selections_owner_select"
  ON public.project_taxonomy_selections
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "project_taxonomy_selections_owner_insert"
  ON public.project_taxonomy_selections
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "project_taxonomy_selections_owner_update"
  ON public.project_taxonomy_selections
  FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE client_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "project_taxonomy_selections_owner_delete"
  ON public.project_taxonomy_selections
  FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE client_id = auth.uid()
    )
  );

CREATE TRIGGER handle_project_taxonomy_selections_updated_at
  BEFORE UPDATE ON public.project_taxonomy_selections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.project_taxonomy_selections IS 'Normalized project taxonomy selections (e.g., location/material features).';
COMMENT ON COLUMN public.project_taxonomy_selections.notes IS 'Optional metadata for future tagging or analytics.';
