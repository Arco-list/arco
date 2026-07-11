-- Auto-relist a company whenever a new active credit lands, UNLESS the
-- owner explicitly set the company to Unlisted.
--
-- Current behaviour: syncCompanyListedStatus (called from a handful of
-- JS callsites) already flips unlisted → listed on new credits, but
-- not every project-add path calls it — so Grand&Johnsen re-added a
-- project and stayed stuck at Unlisted.
--
-- Fix:
--   * companies.manually_unlisted — set to true when the owner picks
--     Unlisted from the visibility popup, cleared when they pick Listed.
--     Auto-unlist (last active credit removed) leaves it alone.
--   * sync_company_listed_status(uuid) — DB-side mirror of the JS
--     helper. Trigger-callable, respects manually_unlisted.
--   * Triggers on project_professionals (INSERT/UPDATE/DELETE) and on
--     projects.status → run the sync automatically so every add-a-project
--     path is covered, not just the ones that remembered to call the
--     JS helper.

ALTER TABLE public.companies
  ADD COLUMN manually_unlisted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.companies.manually_unlisted IS
  'True when the owner explicitly toggled the company to Unlisted (as opposed to the system auto-degrading when the last active credit was removed). When true, the auto-relist trigger skips this company so we do not silently clobber the owner''s choice.';

CREATE OR REPLACE FUNCTION public.sync_company_listed_status(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_active boolean;
  cur_status text;
  cur_setup_completed boolean;
  manual_flag boolean;
BEGIN
  IF p_company_id IS NULL THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.project_professionals pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE pp.company_id = p_company_id
      AND pp.status IN ('listed', 'live_on_page')
      AND p.status = 'published'
  ) INTO has_active;

  SELECT status::text, setup_completed, manually_unlisted
    INTO cur_status, cur_setup_completed, manual_flag
  FROM public.companies
  WHERE id = p_company_id;

  IF cur_status IS NULL THEN RETURN; END IF;

  -- Auto-list from any pre-live state (draft, unlisted, prospected,
  -- invited, unclaimed, added). Skip if the owner manually chose
  -- Unlisted. Excluded: listed (already there), deactivated (admin
  -- intent — do not override). Flip setup_completed if we're coming
  -- out of draft.
  IF has_active
     AND cur_status NOT IN ('listed', 'deactivated')
     AND NOT manual_flag THEN
    UPDATE public.companies
    SET status = 'listed',
        setup_completed = CASE WHEN cur_status = 'draft' THEN true ELSE setup_completed END
    WHERE id = p_company_id;
  ELSIF NOT has_active AND cur_status = 'listed' THEN
    -- Auto-unlist: leave manually_unlisted as-is (system event, not a
    -- user choice). The next active credit will auto-relist unless the
    -- owner steps in and picks Unlisted explicitly.
    UPDATE public.companies SET status = 'unlisted' WHERE id = p_company_id;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'sync_company_listed_status failed for %: %', p_company_id, SQLERRM;
END;
$$;

-- Trigger fn: fire the sync whenever a project_professionals row
-- changes in a way that could shift active-credit state for a company.
CREATE OR REPLACE FUNCTION public.trg_pp_sync_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.company_id IS NOT NULL THEN
      PERFORM public.sync_company_listed_status(OLD.company_id);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.company_id IS NOT NULL THEN
    PERFORM public.sync_company_listed_status(NEW.company_id);
  END IF;

  -- Company-swap: also re-sync the departing company.
  IF TG_OP = 'UPDATE'
     AND OLD.company_id IS NOT NULL
     AND OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    PERFORM public.sync_company_listed_status(OLD.company_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER project_professionals_sync_company_ins
  AFTER INSERT ON public.project_professionals
  FOR EACH ROW EXECUTE FUNCTION public.trg_pp_sync_company();

CREATE TRIGGER project_professionals_sync_company_upd
  AFTER UPDATE OF status, company_id ON public.project_professionals
  FOR EACH ROW EXECUTE FUNCTION public.trg_pp_sync_company();

CREATE TRIGGER project_professionals_sync_company_del
  AFTER DELETE ON public.project_professionals
  FOR EACH ROW EXECUTE FUNCTION public.trg_pp_sync_company();

-- Trigger fn: fire on project status transitions so publish / unpublish
-- fans out to every credited company.
CREATE OR REPLACE FUNCTION public.trg_projects_sync_companies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  FOR cid IN
    SELECT DISTINCT company_id
    FROM public.project_professionals
    WHERE project_id = NEW.id AND company_id IS NOT NULL
  LOOP
    PERFORM public.sync_company_listed_status(cid);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_sync_companies_on_status
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.trg_projects_sync_companies();
