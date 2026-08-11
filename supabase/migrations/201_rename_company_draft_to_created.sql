-- 201: Rename company_status 'draft' -> 'created'
--
-- The admin UI has called this stage "Created" for a while; the enum
-- value still said 'draft', which collided mentally with the unrelated
-- project_status 'draft' and leaked into Apollo as a "Draft" account
-- stage. Rename the value and update every DB function that references
-- the literal.
--
-- Postgres rewrites enum values by oid, so table data, column defaults
-- and indexes follow the rename automatically — only string literals in
-- function bodies need touching. project_status 'draft' is a different
-- enum and is deliberately untouched.

ALTER TYPE public.company_status RENAME VALUE 'draft' TO 'created';

-- 1/5 ── set_company_onboarded_at: stamps onboarded_at when a company
-- leaves the claimed-but-not-listed stage, listed_at on first listing.
CREATE OR REPLACE FUNCTION public.set_company_onboarded_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  owner_source TEXT;
BEGIN
  IF (OLD.status = 'created' AND NEW.status <> 'created' AND NEW.onboarded_at IS NULL) THEN
    NEW.onboarded_at := now();
    IF NEW.owner_id IS NOT NULL AND NEW.first_touch_source IS NULL THEN
      SELECT first_touch_source INTO owner_source
        FROM public.profiles
       WHERE id = NEW.owner_id;
      IF owner_source IS NOT NULL THEN
        NEW.first_touch_source := owner_source;
      END IF;
    END IF;
  END IF;
  IF (OLD.status <> 'listed' AND NEW.status = 'listed' AND NEW.listed_at IS NULL) THEN
    NEW.listed_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

-- 2/5 ── sync_company_listed_status: auto Listed/Unlisted from published
-- project links. 'created' only appears in the setup_completed carry.
CREATE OR REPLACE FUNCTION public.sync_company_listed_status(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF cur_owner IS NULL THEN RETURN; END IF;

  IF has_active
     AND cur_status NOT IN ('listed', 'deactivated')
     AND NOT manual_flag THEN
    UPDATE public.companies
    SET status = 'listed',
        setup_completed = CASE WHEN cur_status = 'created' THEN true ELSE setup_completed END
    WHERE id = p_company_id;
  ELSIF NOT has_active AND cur_status = 'listed' THEN
    UPDATE public.companies SET status = 'unlisted' WHERE id = p_company_id;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'sync_company_listed_status failed for %: %', p_company_id, SQLERRM;
END;
$function$;

-- 3/5 ── sync_prospects_with_company_status: company claim/list cascades
-- into the linked prospects' funnel stage.
CREATE OR REPLACE FUNCTION public.sync_prospects_with_company_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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
      AND status = 'active'
      AND updated_at > now() - interval '1 second';

  ELSIF NEW.status = 'created' THEN
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
$function$;

-- 4/5 ── trg_company_contacts_orphan_on_delete: last team member removed
-- -> company falls back to 'added'.
CREATE OR REPLACE FUNCTION public.trg_company_contacts_orphan_on_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF cur_status IN ('listed', 'unlisted', 'created') THEN
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
$function$;

-- 5/5 ── trg_company_orphan_on_owner_null: owner cleared with no team
-- left -> company falls back to 'added'.
CREATE OR REPLACE FUNCTION public.trg_company_orphan_on_owner_null()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  team_count integer;
BEGIN
  IF NEW.owner_id IS NOT NULL THEN RETURN NEW; END IF;
  IF OLD.owner_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status::text NOT IN ('listed', 'unlisted', 'created') THEN RETURN NEW; END IF;

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
$function$;
