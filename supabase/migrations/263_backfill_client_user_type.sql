-- Give every professional-only profile the `client` type it should
-- have had.
--
-- /admin/users listed profiles carrying `client` or `admin`. That reads
-- like "admins and clients" but was in practice "everyone", because a
-- profile is created with ['client'] and gains 'professional' beside
-- it. Fifteen profiles ended up with 'professional' ALONE and were
-- simply absent from the page — a search for one of those people
-- returned nothing, which reads as "no account".
--
-- The page no longer filters. This squares the data behind it, so the
-- two cannot disagree again: every human on the platform is a client
-- first, and being a professional is something added to that.
--
-- TWO TRIGGERS ARE HELD OFF FOR THE UPDATE, and both matter:
--
--   trigger_homeowner_welcome fires exactly on this transition —
--   gaining 'client' when you did not have it, without 'admin', having
--   signed in at least once. All fifteen qualify. Left alone it would
--   post a homeowner welcome SERIES to fifteen architects: three mails
--   each, telling people who publish buildings how to find a
--   professional. That is the whole reason this is a migration and not
--   a one-line UPDATE.
--
--   refresh_mv_on_profile_change is a ROW trigger that refreshes every
--   materialized view. Fifteen rows is fifteen full refreshes, each
--   blocking the transaction. One refresh at the end does the same job.
--
-- DISABLE TRIGGER is transactional, so a failure here rolls the
-- triggers back on with the data.

BEGIN;

ALTER TABLE public.profiles DISABLE TRIGGER trigger_homeowner_welcome;
ALTER TABLE public.profiles DISABLE TRIGGER refresh_mv_on_profile_change;

UPDATE public.profiles p
   SET user_types = array_prepend('client', p.user_types)
 WHERE p.user_types IS NOT NULL
   AND NOT ('client' = ANY(p.user_types))
   AND NOT ('admin' = ANY(p.user_types));

ALTER TABLE public.profiles ENABLE TRIGGER refresh_mv_on_profile_change;
ALTER TABLE public.profiles ENABLE TRIGGER trigger_homeowner_welcome;

COMMIT;

SELECT public.refresh_all_materialized_views();
