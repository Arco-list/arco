-- Look up one auth user by address, instead of fetching every user to
-- find one.
--
-- Two actions in the signup path — the "does this account exist" check
-- and the ghost cleanup before createUser — both called
-- admin.listUsers({ perPage: 1000 }) and scanned the result in
-- JavaScript. That is 610 GET /admin/users calls in a day to answer a
-- question about a single address, and it stops being CORRECT past a
-- thousand users: perPage caps the page, so an account on page two
-- simply is not there. The check would report "no account" for someone
-- who has one, and the ghost cleanup would leave a ghost in place.
--
-- The fields are the ones the ghost test needs and nothing more: a
-- ghost is a user that was created and then never confirmed and never
-- signed in. No email, no metadata — the caller already knows the
-- address it asked about.
--
-- SECURITY DEFINER because auth.users is not reachable through
-- PostgREST. Execute is granted to service_role only; this is called
-- from server actions holding the service key, never from a browser.

CREATE OR REPLACE FUNCTION public.get_auth_user_by_email(p_email text)
 RETURNS TABLE(id uuid, email_confirmed_at timestamptz, last_sign_in_at timestamptz)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT u.id, u.email_confirmed_at, u.last_sign_in_at
  FROM auth.users u
  WHERE lower(u.email) = lower(btrim(p_email))
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_auth_user_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_by_email(text) TO service_role;
