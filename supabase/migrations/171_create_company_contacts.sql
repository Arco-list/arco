-- Create company_contacts — N:N link between persons and companies.
--
-- Absorbs three legacy populations:
--   - companies.owner_id        → role='owner'
--   - company_members.*         → role='admin' or 'member' (active team)
--   - professionals.*           → role='owner' or 'member' (depending on
--                                  whether they are the company owner)
--   - prospects.company_id      → role='contact' (sales/outbound link)
--
-- Per-deal state (notes, next_follow_up_at, last_contacted_at) lives here
-- rather than on persons because outreach is per-(person, company) — the
-- same person can be a lead at company A and a member at company B with
-- different follow-up cadences.
--
-- Like migration 170, this only creates + backfills. Legacy tables remain
-- in place; the app cutover happens later.

CREATE TYPE public.company_contact_role AS ENUM (
  'contact',  -- Sales contact, lead. Not (yet) a platform user of this company.
  'member',   -- Regular team member.
  'admin',    -- Elevated team member.
  'owner'     -- Company owner. Enforced unique per company (partial index below).
);

CREATE TABLE public.company_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  person_id  uuid NOT NULL REFERENCES public.persons(id)   ON DELETE CASCADE,

  role public.company_contact_role NOT NULL DEFAULT 'contact',
  -- Free-form status field. Mirrors company_members.status today
  -- ('active' | 'invited' | 'removed' | ...). Left as text to avoid an enum
  -- whose values are still in flux.
  status text,

  -- Per-deal state
  notes text,
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,

  -- Invite metadata (carried over from company_members for team contacts)
  invited_at timestamptz,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at  timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (company_id, person_id)
);

-- One owner per company.
CREATE UNIQUE INDEX company_contacts_one_owner_per_company
  ON public.company_contacts (company_id)
  WHERE role = 'owner';

CREATE INDEX company_contacts_company_id_idx  ON public.company_contacts (company_id);
CREATE INDEX company_contacts_person_id_idx   ON public.company_contacts (person_id);
CREATE INDEX company_contacts_role_idx        ON public.company_contacts (role);
CREATE INDEX company_contacts_next_follow_idx ON public.company_contacts (next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL;

CREATE TRIGGER company_contacts_set_updated_at
  BEFORE UPDATE ON public.company_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.company_contacts ENABLE ROW LEVEL SECURITY;

-- Admin / service_role only for now. Team + public visibility will be added
-- when the app cuts over to read team members through this table (migration
-- 173). Today's team-display still reads `company_members` and
-- `professionals` directly, so this table being admin-only is harmless.
CREATE POLICY company_contacts_admin_all ON public.company_contacts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND 'admin' = ANY (profiles.user_types)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND 'admin' = ANY (profiles.user_types)
    )
  );

CREATE POLICY company_contacts_service_role_all ON public.company_contacts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Backfill ----------------------------------------------------------------
-- Order matters: most-authoritative first. UNIQUE(company_id, person_id)
-- means later inserts targeting the same pair are no-ops, so the order
-- determines the role that wins for any (person, company) that appears in
-- multiple legacy tables.

-- 1. Owners. companies.owner_id is the source of truth for the owner of a
-- company. Joined to persons via auth_user_id.
INSERT INTO public.company_contacts (
  company_id, person_id, role, status, joined_at
)
SELECT c.id, p.id, 'owner', 'active', NULL
FROM public.companies c
JOIN public.persons p ON p.auth_user_id = c.owner_id
WHERE c.owner_id IS NOT NULL
ON CONFLICT (company_id, person_id) DO NOTHING;

-- 2. Team members from company_members. Today all rows are role='admin'.
-- Map the legacy role string to the enum (anything other than 'admin'
-- falls back to 'member'). Some rows have user_id (signed-up team member)
-- and some only have email (invite accepted but never linked back) — handle
-- both. The email-only branch may need to create a person row first.

-- 2a. Create persons for any invite-by-email rows that don't yet have a
-- person record. Source = 'invited' since they entered via team invite.
INSERT INTO public.persons (email, source)
SELECT DISTINCT cm.email, 'invited'::public.person_source
FROM public.company_members cm
WHERE cm.email IS NOT NULL AND cm.user_id IS NULL
ON CONFLICT (lower(email)) DO NOTHING;

-- 2b. Insert team members via user_id (signed-up) OR email (invite-only).
INSERT INTO public.company_contacts (
  company_id, person_id, role, status, invited_at, invited_by, joined_at,
  created_at, updated_at
)
SELECT
  cm.company_id,
  p.id,
  CASE WHEN cm.role = 'admin' THEN 'admin'::public.company_contact_role
       ELSE 'member'::public.company_contact_role
  END,
  cm.status,
  cm.invited_at,
  cm.invited_by,
  cm.joined_at,
  cm.created_at,
  cm.updated_at
FROM public.company_members cm
JOIN public.persons p
  ON (cm.user_id IS NOT NULL AND p.auth_user_id = cm.user_id)
  OR (cm.user_id IS NULL AND cm.email IS NOT NULL AND lower(p.email) = lower(cm.email))
ON CONFLICT (company_id, person_id) DO NOTHING;

-- 3. Professionals not already covered by owner or member backfill. These
-- are public team-profile rows that lack a corresponding company_members
-- row. Treated as 'member'.
INSERT INTO public.company_contacts (
  company_id, person_id, role, status, created_at, updated_at
)
SELECT
  prof.company_id, p.id, 'member', 'active', prof.created_at, prof.updated_at
FROM public.professionals prof
JOIN public.persons p ON p.auth_user_id = prof.user_id
WHERE prof.company_id IS NOT NULL
  AND prof.user_id IS NOT NULL
ON CONFLICT (company_id, person_id) DO NOTHING;

-- 4. Prospect contacts. Sales attachments — same person can be a prospect
-- at multiple companies. Joined to persons via email (since prospects
-- predate auth.users for most rows).
INSERT INTO public.company_contacts (
  company_id, person_id, role, status,
  notes, last_contacted_at, next_follow_up_at,
  created_at, updated_at
)
SELECT
  pr.company_id, ps.id, 'contact', NULL,
  pr.notes, pr.last_outbound_at, pr.next_follow_up_at,
  pr.created_at, pr.updated_at
FROM public.prospects pr
JOIN public.persons ps ON lower(ps.email) = lower(pr.email)
WHERE pr.company_id IS NOT NULL
ON CONFLICT (company_id, person_id) DO NOTHING;
