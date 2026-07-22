-- Soft-link prospects to their signed-up account when the linked
-- company gets claimed. Powers the Contact Card "Aliases" display
-- so that opening the outreach email (annebel@meetarchie.nl) surfaces
-- the signup email (info@meetarchie.nl) and vice versa — without
-- merging identities or touching any email column.
--
-- Reference: earlier design decision to "soft-link, not merge" —
-- prospects.user_id is the pointer we already had; this fills it in.

-- ── Trigger ────────────────────────────────────────────────────────────
--
-- Fires on companies UPDATE when owner_id transitions to a non-null
-- value (claim). Sweeps every prospect for that company_id whose
-- user_id is still null and points it at the new owner. Silent when
-- the transition is NULL -> NULL, non-null -> null (unclaim), or
-- same-non-null (no-op update).

CREATE OR REPLACE FUNCTION public.trg_stitch_prospects_on_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.owner_id IS NOT DISTINCT FROM NEW.owner_id THEN RETURN NEW; END IF;

  UPDATE public.prospects
  SET user_id = NEW.owner_id
  WHERE company_id = NEW.id
    AND user_id IS NULL;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'trg_stitch_prospects_on_claim failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER companies_stitch_prospects_on_claim
  AFTER UPDATE OF owner_id ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.trg_stitch_prospects_on_claim();

-- ── One-shot backfill ─────────────────────────────────────────────────
--
-- 9 orphan prospect rows exist at migration time (queried before
-- writing this): prospects with user_id NULL whose linked company has
-- already been claimed. Stitch them now so the Contact Card behaves
-- correctly for pre-migration data.

UPDATE public.prospects p
SET user_id = c.owner_id
FROM public.companies c
WHERE p.company_id = c.id
  AND p.user_id IS NULL
  AND c.owner_id IS NOT NULL;
