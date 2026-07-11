-- Orphaned companies auto-flip to 'added'.
--
-- Rule (confirmed with owner): if a company has zero team_members
-- (owner/admin/member rows in company_contacts), it's considered
-- orphaned regardless of legacy companies.owner_id, and status flips
-- to 'added' with owner_id cleared. Precedence: this beats the credits-
-- driven auto-list rule — no team = nothing to list.
--
-- Rules cascade:
--   * status = deactivated → never overridden (admin intent).
--   * team_members = 0 → 'added', owner_id = NULL.
--   * team_members > 0 + active credit + not manually_unlisted → 'listed'.
--   * team_members > 0 + no active credit + status = 'listed' → 'unlisted'.

CREATE OR REPLACE FUNCTION public.sync_company_listed_status(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_count integer;
  has_active boolean;
  cur_status text;
  cur_owner_id uuid;
  manual_flag boolean;
BEGIN
  IF p_company_id IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO team_count
  FROM public.company_contacts cc
  WHERE cc.company_id = p_company_id
    AND cc.role IN ('owner', 'admin', 'member');

  SELECT status::text, manually_unlisted, owner_id
    INTO cur_status, manual_flag, cur_owner_id
  FROM public.companies
  WHERE id = p_company_id;

  IF cur_status IS NULL THEN RETURN; END IF;
  IF cur_status = 'deactivated' THEN RETURN; END IF;

  -- Orphan: BOTH team_count=0 AND owner_id IS NULL. Only fires when
  -- both representations of ownership agree the company has nobody —
  -- prevents legacy companies whose ownership lives only in
  -- companies.owner_id (never backfilled to company_contacts) from
  -- being incorrectly demoted.
  IF team_count = 0 AND cur_owner_id IS NULL THEN
    IF cur_status <> 'added' THEN
      UPDATE public.companies SET status = 'added' WHERE id = p_company_id;
    END IF;
    RETURN;
  END IF;

  -- Legacy path: team=0 but owner_id set. Leave the row untouched here
  -- (its existing status — prospected/unclaimed/etc — was set intentionally).
  IF team_count = 0 THEN RETURN; END IF;

  -- Has team members. Apply credit-based rules.
  SELECT EXISTS (
    SELECT 1 FROM public.project_professionals pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE pp.company_id = p_company_id
      AND pp.status IN ('listed', 'live_on_page')
      AND p.status = 'published'
  ) INTO has_active;

  IF has_active
     AND cur_status NOT IN ('listed', 'deactivated')
     AND NOT manual_flag THEN
    UPDATE public.companies
    SET status = 'listed',
        setup_completed = CASE WHEN cur_status = 'draft' THEN true ELSE setup_completed END
    WHERE id = p_company_id;
  ELSIF NOT has_active AND cur_status = 'listed' THEN
    UPDATE public.companies SET status = 'unlisted' WHERE id = p_company_id;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'sync_company_listed_status failed for %: %', p_company_id, SQLERRM;
END;
$$;

-- New trigger: fire the sync whenever team membership changes so an
-- orphan flip / re-owning happens immediately.
CREATE OR REPLACE FUNCTION public.trg_company_contacts_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_company_listed_status(OLD.company_id);
    RETURN OLD;
  END IF;
  PERFORM public.sync_company_listed_status(NEW.company_id);
  IF TG_OP = 'UPDATE'
     AND OLD.company_id IS NOT NULL
     AND OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    PERFORM public.sync_company_listed_status(OLD.company_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER company_contacts_sync_status_ins
  AFTER INSERT ON public.company_contacts
  FOR EACH ROW EXECUTE FUNCTION public.trg_company_contacts_sync();

CREATE TRIGGER company_contacts_sync_status_upd
  AFTER UPDATE OF role, company_id ON public.company_contacts
  FOR EACH ROW EXECUTE FUNCTION public.trg_company_contacts_sync();

CREATE TRIGGER company_contacts_sync_status_del
  AFTER DELETE ON public.company_contacts
  FOR EACH ROW EXECUTE FUNCTION public.trg_company_contacts_sync();
