-- ═══════════════════════════════════════════════════════════════════════
-- 237: The Listed series fires the first time a company goes listed
-- ═══════════════════════════════════════════════════════════════════════
-- Last step of the pro funnel. When companies.status flips to 'listed'
-- for the first time, two drip rows are enqueued for the owner:
--
--   1. company-live         → send_at now()            "you're live"
--   2. listed-professionals → +3 business days, 09:00  the network ask
--
-- Both are ABSTRACT templates: the drip cron resolves the publisher /
-- contributor variant at send time (lib/listed-mails.ts). The third
-- mail of the series (listed-backlink) is built but NOT enqueued —
-- it waits for the /badges page to exist.
--
-- The trigger lives DB-side (not in syncCompanyListedStatus) because
-- listing happens from several paths: the JS helper, the admin actions,
-- and the migration-185 DB trigger on project changes. One AFTER UPDATE
-- trigger catches them all. Dedupe: one company-live per company, ever.

-- Next business day helper: p_days business days ahead, at 09:00
-- Amsterdam time. Mirrors lib/date-utils nextBusinessSlot.
CREATE OR REPLACE FUNCTION next_business_send(p_days int)
RETURNS timestamptz AS $$
DECLARE
  d date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
  added int := 0;
BEGIN
  WHILE added < p_days LOOP
    d := d + 1;
    IF extract(isodow FROM d) < 6 THEN
      added := added + 1;
    END IF;
  END LOOP;
  RETURN timezone('Europe/Amsterdam', d + time '09:00');
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION enqueue_listed_series()
RETURNS trigger AS $$
DECLARE
  v_email text;
BEGIN
  -- Only claimed companies list; without an owner there is no inbox.
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.owner_id;
  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- First listing only: any prior company-live row (sent, pending or
  -- cancelled) means this company already had its moment.
  IF EXISTS (
    SELECT 1 FROM public.email_drip_queue
    WHERE company_id = NEW.id AND template = 'company-live'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.email_drip_queue (email, user_id, template, sequence, company_id, send_at, variables)
  VALUES (v_email, NEW.owner_id, 'company-live', 'listed-series', NEW.id, now(),
    jsonb_build_object('company_name', NEW.name));

  INSERT INTO public.email_drip_queue (email, user_id, template, sequence, company_id, send_at, variables)
  VALUES (v_email, NEW.owner_id, 'listed-professionals', 'listed-series', NEW.id, public.next_business_send(3),
    jsonb_build_object('company_name', NEW.name));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_listed_series ON companies;
CREATE TRIGGER trigger_listed_series
  AFTER UPDATE OF status ON companies
  FOR EACH ROW
  WHEN (NEW.status = 'listed' AND OLD.status IS DISTINCT FROM 'listed')
  EXECUTE FUNCTION enqueue_listed_series();
