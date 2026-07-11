-- Fallback for migration 191. The company_contacts DELETE trigger
-- misses two shapes:
--
--   1. Legacy companies where owner_id was populated but no matching
--      company_contacts row exists (source-of-truth wasn't backfilled).
--      Removing "the last user" via the admin UI does nothing to
--      company_contacts, so the trigger has no event to hook.
--   2. Any path that clears companies.owner_id directly (bulk unlink,
--      admin script) without also deleting the contact row.
--
-- This trigger fires on companies UPDATE OF owner_id: if the row
-- transitions to owner_id IS NULL, no team-role contacts remain, and
-- the company is still sitting in a claimed status (listed / unlisted /
-- draft), flip status to 'added'. Matches the migration-191 rule.

CREATE OR REPLACE FUNCTION public.trg_company_orphan_on_owner_null()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_count integer;
BEGIN
  IF NEW.owner_id IS NOT NULL THEN RETURN NEW; END IF;
  IF OLD.owner_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status::text NOT IN ('listed', 'unlisted', 'draft') THEN RETURN NEW; END IF;

  SELECT count(*) INTO team_count
  FROM public.company_contacts
  WHERE company_id = NEW.id
    AND role IN ('owner', 'admin', 'member');

  IF team_count = 0 THEN
    UPDATE public.companies
    SET status = 'added'
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'trg_company_orphan_on_owner_null failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER company_orphan_on_owner_null
  AFTER UPDATE OF owner_id ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.trg_company_orphan_on_owner_null();
