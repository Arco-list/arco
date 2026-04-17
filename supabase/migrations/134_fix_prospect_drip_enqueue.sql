-- ═══════════════════════════════════════════════════════════════════════
-- 134: Fix prospect drip enqueue + auto-finish on conversion
-- ═══════════════════════════════════════════════════════════════════════
-- Two bugs in one migration, both surfacing in /admin/sales:
--
-- 1. Every prospect follow-up / final enqueue since migration 118 has
--    been silently failing with 23502 (NOT NULL violation on user_id).
--    The queue was designed for homeowner drips (welcome-homeowner,
--    discover-projects, find-professionals) where the recipient is a
--    signed-up user with a user_id. Prospect-series rows target scraped
--    companies that haven't signed up yet — there is no user_id to put
--    there. The app code at admin/professionals/actions.ts:1072 doesn't
--    pass user_id, so every insert fails and the admin-facing error
--    handler only special-cases 23505 (unique violation), so the failure
--    lands silently in logs.
--
--    Fix: user_id becomes nullable. Homeowner rows continue to populate
--    it; prospect rows leave it null. The partial unique index added in
--    migration 120 ((company_id, template) WHERE pending) already guards
--    prospect duplicates, and the original (user_id, sequence, step)
--    unique constraint still protects homeowner flows because Postgres
--    treats NULLs as distinct in unique indexes.
--
-- 2. When a prospect converts (signs up, claims a company, lists a
--    company), any pending drip rows should stop firing so the converted
--    prospect doesn't keep receiving outreach. Migration 132's trigger
--    already advances the prospect funnel status on company transitions
--    but never touched the drip queue. This migration adds a trigger on
--    prospects.status that cancels pending drip rows when the prospect
--    advances to any of signup / company / active, with reason
--    'status_change' so the Outreach Sequence popup can render it as
--    "Finished".
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.email_drip_queue
  ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN public.email_drip_queue.user_id IS
  'Recipient user id for homeowner-series drips. Null for prospect-series rows (scraped companies with no signed-up owner yet) — those rows are keyed by company_id + template instead.';

-- ─── Auto-cancel drips when the prospect converts ───────────────────────

CREATE OR REPLACE FUNCTION public.cancel_drips_on_prospect_advance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Only advance. Never cancel on pause/contacted/etc — those have their
  -- own handling in the admin actions.
  IF NEW.status IN ('signup', 'company', 'active') AND NEW.company_id IS NOT NULL THEN
    UPDATE public.email_drip_queue
       SET cancelled_at = now(),
           cancelled_reason = 'status_change'
     WHERE company_id = NEW.company_id
       AND sent_at IS NULL
       AND cancelled_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.cancel_drips_on_prospect_advance() IS
  'When a prospect advances to signup / company / active, cancel its company''s pending drip rows with reason status_change so the outreach series stops firing. Forward-only — does not touch sent or already-cancelled rows.';

DROP TRIGGER IF EXISTS trg_cancel_drips_on_prospect_advance ON public.prospects;
CREATE TRIGGER trg_cancel_drips_on_prospect_advance
  AFTER INSERT OR UPDATE OF status ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.cancel_drips_on_prospect_advance();
