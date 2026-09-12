-- ═══════════════════════════════════════════════════════════════════════
-- 239: The owner's prospect advances to Active when the company lists
-- ═══════════════════════════════════════════════════════════════════════
-- The prospect→'active' (= Listed) flip only lived in ONE path: the
-- dashboard's complete-company-setup action. Companies that list via
-- any other route — credit acceptance auto-listing (the contributor
-- conversion path!), admin listing, the migration-185 project trigger —
-- left their prospect behind (i29 sat on Visitor in /admin/sales while
-- Listed on /admin/companies), understating the funnel's listing rate.
--
-- DB trigger on the same flip as the Listed mail series (237): promote
-- the OWNER's own prospect row — linked by user_id or the owner's auth
-- email — and only the furthest-progressed one. Co-contacts at the
-- company stay where they are (only the converting person converts).

CREATE OR REPLACE FUNCTION advance_prospect_on_company_listed()
RETURNS trigger AS $$
DECLARE
  v_owner_email text;
  v_id uuid;
  v_old text;
BEGIN
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT email INTO v_owner_email FROM auth.users WHERE id = NEW.owner_id;

  SELECT p.id, p.status::text INTO v_id, v_old
  FROM public.prospects p
  WHERE (p.user_id = NEW.owner_id
         OR (v_owner_email IS NOT NULL AND lower(p.email) = lower(v_owner_email)))
    AND p.status::text NOT IN ('active', 'removed')
  ORDER BY array_position(
    ARRAY['prospect','contacted','visitor','signup','verified','company','owned'],
    p.status::text) DESC NULLS LAST
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.prospects
  SET status = 'active', converted_at = COALESCE(converted_at, now())
  WHERE id = v_id;

  INSERT INTO public.prospect_events (prospect_id, event_type, event_source, old_status, new_status, metadata)
  VALUES (v_id, 'status_change', 'db', v_old::prospect_status, 'active',
    jsonb_build_object('via', 'company_listed', 'company_id', NEW.id));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_prospect_active_on_listed ON companies;
CREATE TRIGGER trigger_prospect_active_on_listed
  AFTER UPDATE OF status ON companies
  FOR EACH ROW
  WHEN (NEW.status = 'listed' AND OLD.status IS DISTINCT FROM 'listed')
  EXECUTE FUNCTION advance_prospect_on_company_listed();
