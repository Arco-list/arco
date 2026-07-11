-- When the last team member of a claimed company (listed / unlisted /
-- created) is removed, the company falls back to Added and its
-- owner_id is cleared.
--
-- Only fires on DELETE from company_contacts, and only when the
-- current status is one of listed / unlisted / draft — never touches
-- companies that started life without an owner (prospected, added,
-- invited, unclaimed) since those have no team to lose.
--
-- Deactivated is out of scope (admin lifecycle, not user-driven).

CREATE OR REPLACE FUNCTION public.trg_company_contacts_orphan_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_count integer;
  cur_status text;
BEGIN
  SELECT count(*) INTO team_count
  FROM public.company_contacts
  WHERE company_id = OLD.company_id
    AND role IN ('owner', 'admin', 'member');

  IF team_count > 0 THEN RETURN OLD; END IF;

  SELECT status::text INTO cur_status
  FROM public.companies WHERE id = OLD.company_id;

  IF cur_status IN ('listed', 'unlisted', 'draft') THEN
    UPDATE public.companies
    SET status = 'added',
        owner_id = NULL
    WHERE id = OLD.company_id;
  END IF;

  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'trg_company_contacts_orphan_on_delete failed: %', SQLERRM;
  RETURN OLD;
END;
$$;

CREATE TRIGGER company_contacts_orphan_on_delete
  AFTER DELETE ON public.company_contacts
  FOR EACH ROW EXECUTE FUNCTION public.trg_company_contacts_orphan_on_delete();
