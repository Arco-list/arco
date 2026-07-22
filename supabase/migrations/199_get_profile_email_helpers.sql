-- Contact Card Aliases support.
--
-- The card's "soft-link, not merge" model surfaces every alias email
-- tied to the same signed-up account. Two RPCs power this:
--
--   1. get_profile_by_email(email) — extended from migration 197 to
--      return auth.users.email alongside the profile fields. Used to
--      detect the signup email when the queried email is only a
--      prospect (annebel@meetarchie.nl -> the signup lives at
--      info@meetarchie.nl).
--
--   2. get_profile_email_by_id(user_id) — companion lookup. When the
--      email path enters via prospects → user_id, we still need the
--      signup email to render it in the Aliases row.

DROP FUNCTION IF EXISTS public.get_profile_by_email(text);

CREATE OR REPLACE FUNCTION public.get_profile_by_email(p_email text)
RETURNS TABLE (
  id uuid,
  email text,
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
    u.email::text AS email,
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

CREATE OR REPLACE FUNCTION public.get_profile_email_by_id(p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email::text FROM auth.users u WHERE u.id = p_user_id LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_profile_email_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_email_by_id(uuid) TO service_role;
