-- Create prospect_status enum
CREATE TYPE public.prospect_status AS ENUM (
  'imported',
  'sequence_active',
  'email_opened',
  'email_clicked',
  'landing_visited',
  'signed_up',
  'company_created',
  'project_started',
  'project_published',
  'converted',
  'unsubscribed',
  'bounced'
);

-- Create prospects table
CREATE TABLE public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  contact_name text,
  company_name text,
  city text,
  source text NOT NULL DEFAULT 'manual',
  status public.prospect_status NOT NULL DEFAULT 'imported',
  ref_code text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  apollo_contact_id text,
  apollo_account_id text,
  emails_sent integer NOT NULL DEFAULT 0,
  emails_opened integer NOT NULL DEFAULT 0,
  emails_clicked integer NOT NULL DEFAULT 0,
  linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  linked_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  first_email_sent_at timestamptz,
  last_email_sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  landing_visited_at timestamptz,
  signed_up_at timestamptz,
  company_created_at timestamptz,
  project_started_at timestamptz,
  project_published_at timestamptz,
  converted_at timestamptz,
  unsubscribed_at timestamptz,
  bounced_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX idx_prospects_status ON public.prospects(status);
CREATE INDEX idx_prospects_source ON public.prospects(source);
CREATE INDEX idx_prospects_email ON public.prospects(email);
CREATE INDEX idx_prospects_created_at ON public.prospects(created_at DESC);

-- Create prospect_events table for tracking history
CREATE TABLE public.prospect_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prospect_events_prospect_id ON public.prospect_events(prospect_id);
CREATE INDEX idx_prospect_events_created_at ON public.prospect_events(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_prospects_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prospects_updated_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.update_prospects_updated_at();

-- RLS policies (admin only)
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on prospects" ON public.prospects
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.admin_role IS NOT NULL
    )
  );

CREATE POLICY "Admin full access on prospect_events" ON public.prospect_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.admin_role IS NOT NULL
    )
  );

-- Funnel aggregation function
CREATE OR REPLACE FUNCTION public.get_prospect_funnel()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.prospects),
    'imported', (SELECT count(*) FROM public.prospects WHERE status = 'imported'),
    'sequence_active', (SELECT count(*) FROM public.prospects WHERE status = 'sequence_active'),
    'email_opened', (SELECT count(*) FROM public.prospects WHERE status = 'email_opened'),
    'email_clicked', (SELECT count(*) FROM public.prospects WHERE status = 'email_clicked'),
    'landing_visited', (SELECT count(*) FROM public.prospects WHERE status = 'landing_visited'),
    'signed_up', (SELECT count(*) FROM public.prospects WHERE status = 'signed_up'),
    'company_created', (SELECT count(*) FROM public.prospects WHERE status = 'company_created'),
    'project_started', (SELECT count(*) FROM public.prospects WHERE status = 'project_started'),
    'project_published', (SELECT count(*) FROM public.prospects WHERE status = 'project_published'),
    'converted', (SELECT count(*) FROM public.prospects WHERE status = 'converted'),
    'unsubscribed', (SELECT count(*) FROM public.prospects WHERE status = 'unsubscribed'),
    'bounced', (SELECT count(*) FROM public.prospects WHERE status = 'bounced'),
    'with_opens', (SELECT count(*) FROM public.prospects WHERE emails_opened > 0),
    'with_clicks', (SELECT count(*) FROM public.prospects WHERE emails_clicked > 0),
    'total_emails_sent', (SELECT coalesce(sum(emails_sent), 0) FROM public.prospects)
  );
$$;
