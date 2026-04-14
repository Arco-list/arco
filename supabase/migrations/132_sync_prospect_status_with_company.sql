-- ═══════════════════════════════════════════════════════════════════════
-- 132: Push Draft / Listed status from companies to prospects
-- ═══════════════════════════════════════════════════════════════════════
-- Keep the Sales table (prospects) in sync with companies.status whenever
-- a company enters 'draft' or 'listed'. Previously this sync only ran
-- inside the user-facing complete_company_setup action, which missed:
--   • admin edits that flip status directly
--   • scraper imports that create companies already 'listed'
--   • any multi-prospect case (owner email + outreach email) where the
--     app-side .maybeSingle() silently errored
--
-- Forward-only semantics — a prospect that's already 'active' is never
-- demoted back to 'company', since the Sales funnel treats conversion
-- as terminal.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_prospects_with_company_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On UPDATE, skip when status hasn't actually changed (other column
  -- edits to a company shouldn't retrigger the funnel sync).
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'listed' THEN
    UPDATE public.prospects
       SET status = 'active',
           converted_at = COALESCE(converted_at, now())
     WHERE company_id = NEW.id
       AND status <> 'active';

    INSERT INTO public.prospect_events (prospect_id, event_type, metadata)
    SELECT id,
           'status_changed',
           jsonb_build_object(
             'new_status', 'active',
             'old_status', status,
             'trigger', 'sync_with_company_status',
             'company_id', NEW.id
           )
    FROM public.prospects
    WHERE company_id = NEW.id
      AND status = 'active'  -- just set above; audit every row we touched
      AND updated_at > now() - interval '1 second';

  ELSIF NEW.status = 'draft' THEN
    UPDATE public.prospects
       SET status = 'company',
           company_created_at = COALESCE(company_created_at, now())
     WHERE company_id = NEW.id
       AND status NOT IN ('company', 'active');

    INSERT INTO public.prospect_events (prospect_id, event_type, metadata)
    SELECT id,
           'status_changed',
           jsonb_build_object(
             'new_status', 'company',
             'old_status', status,
             'trigger', 'sync_with_company_status',
             'company_id', NEW.id
           )
    FROM public.prospects
    WHERE company_id = NEW.id
      AND status = 'company'
      AND updated_at > now() - interval '1 second';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_prospects_with_company_status() IS
  'Advances linked prospects to ''company'' / ''active'' when a company transitions to ''draft'' / ''listed''. Forward-only — never demotes ''active'' prospects.';

DROP TRIGGER IF EXISTS trg_sync_prospects_with_company_status ON public.companies;
CREATE TRIGGER trg_sync_prospects_with_company_status
  AFTER INSERT OR UPDATE OF status ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.sync_prospects_with_company_status();
