-- Row-level security for company_contacts and persons.
--
-- Two goals:
--   1. Fix the pre-existing infinite recursion on `company_members` RLS
--      (the legacy `company_members_member_read` policy referenced
--      `company_members` from inside its own USING clause).
--   2. Let team members of a company read their teammates' contact rows
--      and person rows, without triggering the same recursion pattern.
--
-- Pattern: SECURITY DEFINER helper functions that bypass RLS when looking
-- up membership, and lightweight policies that delegate to those helpers.
-- The MV / search RPC rewrite is deferred to a later migration alongside
-- the app-code cutover — this migration is RLS-only.

-- ────────────────────────────────────────────────────────────────────────
-- 1. Fix the company_members recursion (consolidates the drafted-but-never-
-- applied migration 168). Helper runs as definer, so its inner SELECT on
-- company_members skips RLS evaluation and the recursion can't form.
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_active_company_member(_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM company_members
    WHERE company_id = _company_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_company_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_active_company_member(uuid) TO authenticated;

DROP POLICY IF EXISTS company_members_member_read ON public.company_members;
CREATE POLICY company_members_member_read ON public.company_members
FOR SELECT
TO authenticated
USING (public.is_active_company_member(company_id));

-- ────────────────────────────────────────────────────────────────────────
-- 2. Helper: is the current user a contact-with-team-role at this company,
-- via company_contacts? Used by both the company_contacts and persons
-- policies. Same recursion-bypass pattern.
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_company_contact_for_current_user(_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM company_contacts cc
    JOIN persons p ON p.id = cc.person_id
    WHERE cc.company_id = _company_id
      AND p.auth_user_id = auth.uid()
      AND cc.role IN ('owner', 'admin', 'member')
  );
$$;

REVOKE ALL ON FUNCTION public.is_company_contact_for_current_user(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_company_contact_for_current_user(uuid) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 3. Team-member read access on company_contacts. Two paths:
--   - The current user owns the company (companies.owner_id = auth.uid())
--   - The current user is a team-role contact of the company (via helper)
-- Admin and service_role policies from migration 171 still apply (PERMISSIVE
-- policies OR together).
-- ────────────────────────────────────────────────────────────────────────

CREATE POLICY company_contacts_team_read ON public.company_contacts
FOR SELECT
TO authenticated
USING (
  public.is_company_contact_for_current_user(company_id)
  OR EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.id = company_contacts.company_id
      AND companies.owner_id = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────────────────
-- 4. Persons visibility. A user can read:
--   - their own person row (auth_user_id = auth.uid())
--   - persons who are contacts at companies where the user has a
--     team role (via the helper above)
-- For the second case we use a definer helper that takes person_id and
-- looks across every company_contacts row for that person, returning true
-- if *any* of those companies is one where the current user is also a
-- contact-with-team-role.
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.person_visible_to_current_user(_person_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM company_contacts cc
    WHERE cc.person_id = _person_id
      AND (
        public.is_company_contact_for_current_user(cc.company_id)
        OR EXISTS (
          SELECT 1 FROM companies
          WHERE companies.id = cc.company_id
            AND companies.owner_id = auth.uid()
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.person_visible_to_current_user(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.person_visible_to_current_user(uuid) TO authenticated;

CREATE POLICY persons_self_read ON public.persons
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

CREATE POLICY persons_team_read ON public.persons
FOR SELECT
TO authenticated
USING (public.person_visible_to_current_user(id));
