-- Contact Card fallback discovery.
--
-- Phase 1 of the shared Contact Card (lib/contacts/get-contact-by-email.ts)
-- started from prospects.email and hydrated the profile via any linked
-- user_id. Users with no prospect row — architects/professionals who
-- signed up directly, without ever being an outreach target — were
-- therefore invisible to the card on /admin/users. Clicking such a row
-- opened a mostly-empty panel with "No prospect record on this email".
--
-- This helper closes the gap: given an email, return the linked
-- profile fields the card needs (plus the auth id, which lets the
-- caller then load company_contacts via person_id). Joins auth.users
-- because profiles doesn't carry email; auth schema isn't exposed via
-- PostgREST by default so a SECURITY DEFINER RPC is the cleanest path.
--
-- Case-insensitive match so a manually-entered link with a capital in
-- the address still resolves.

CREATE OR REPLACE FUNCTION public.get_profile_by_email(p_email text)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  phone text,
  is_active boolean,
  user_types text[],
  admin_role text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.phone,
    p.is_active,
    p.user_types,
    p.admin_role::text
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_profile_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_by_email(text) TO service_role;
