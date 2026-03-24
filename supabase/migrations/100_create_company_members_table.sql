-- Migration: Create company_members table for team management
-- Tracks team membership and invitations for companies.
-- Separate from professionals table which is for marketplace-facing profiles.

CREATE TABLE public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'invited',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by UUID REFERENCES public.profiles(id),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT company_members_role_check CHECK (role IN ('admin', 'member')),
  CONSTRAINT company_members_status_check CHECK (status IN ('invited', 'active')),
  CONSTRAINT company_members_unique_email UNIQUE (company_id, email)
);

-- Indexes
CREATE INDEX idx_company_members_company ON public.company_members(company_id);
CREATE INDEX idx_company_members_user ON public.company_members(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_company_members_email ON public.company_members(email);

-- Enable RLS
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- RLS: Company owner can read all members
CREATE POLICY "company_members_owner_read"
  ON public.company_members FOR SELECT
  USING (company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid()));

-- RLS: Active members can read their own company's members
CREATE POLICY "company_members_member_read"
  ON public.company_members FOR SELECT
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = auth.uid() AND cm.status = 'active'
    )
  );

-- RLS: Company owner and admin members can insert
CREATE POLICY "company_members_admin_insert"
  ON public.company_members FOR INSERT
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    OR company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role = 'admin' AND cm.status = 'active'
    )
  );

-- RLS: Company owner can update members
CREATE POLICY "company_members_owner_update"
  ON public.company_members FOR UPDATE
  USING (company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid()));

-- RLS: Company owner can delete members
CREATE POLICY "company_members_owner_delete"
  ON public.company_members FOR DELETE
  USING (company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid()));

-- Updated_at trigger
CREATE TRIGGER handle_company_members_updated_at
  BEFORE UPDATE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Grants
GRANT ALL ON public.company_members TO authenticated;
GRANT SELECT ON public.company_members TO anon;

-- Seed existing company owners as admin members
INSERT INTO public.company_members (company_id, user_id, email, role, status, joined_at)
SELECT
  c.id,
  c.owner_id,
  COALESCE(au.email, c.email, 'unknown@arco.com'),
  'admin',
  'active',
  c.created_at
FROM public.companies c
LEFT JOIN auth.users au ON au.id = c.owner_id
WHERE c.owner_id IS NOT NULL
ON CONFLICT (company_id, email) DO NOTHING;

NOTIFY pgrst, 'reload schema';
