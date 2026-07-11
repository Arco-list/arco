-- Tighten sync_company_listed_status: auto-list only applies to
-- CLAIMED companies (owner_id IS NOT NULL).
--
-- Bug: after adding Lab32 (status='added', owner_id=NULL) and
-- crediting it on a project, accepting the invite flipped
-- pp.status → live_on_page, which fires trg_pp_sync_company →
-- sync_company_listed_status. The old condition
-- (cur_status NOT IN ('listed', 'deactivated')) auto-listed the
-- company even though it had no owner, bypassing the claim flow.
--
-- New rule mirrors the segment picker in the admin popup:
--
--   * Only claimed companies (owner_id IS NOT NULL) auto-list when
--     they gain an active credit. This covers the intended paths —
--     Created / Unlisted owners re-listing on a new credit.
--   * Unclaimed pre-sales states (added, invited, prospected,
--     unclaimed) stay put. They can only move forward via the claim
--     flow, which sets owner_id and the appropriate status.
--   * Auto-unlist (listed → unlisted when last credit is dropped)
--     is likewise gated to owners — an unclaimed company shouldn't
--     have reached 'listed' in the first place with this rule.
--   * manually_unlisted, deactivated, listed skips are unchanged.

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
  cur_owner uuid;
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

  SELECT status::text, setup_completed, manually_unlisted, owner_id
    INTO cur_status, cur_setup_completed, manual_flag, cur_owner
  FROM public.companies
  WHERE id = p_company_id;

  IF cur_status IS NULL THEN RETURN; END IF;
  -- Unclaimed companies never auto-transition. They advance only
  -- through the claim flow (which assigns owner_id).
  IF cur_owner IS NULL THEN RETURN; END IF;

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
