-- The drip-cancel trigger still spoke the old funnel vocabulary.
--
-- It fired on status IN ('signup', 'company', 'active'). Two of those
-- three words no longer exist: the funnel was renamed to
-- prospect → contacted → visitor → verified → owned → unlisted → active,
-- and nothing has written 'signup' or 'company' since — except one line
-- in the company-setup action that had not been told either, and which
-- now writes 'owned'.
--
-- While both sides still used the dead word, finishing company setup
-- WITHOUT listing cancelled every pending drip row for that company. The
-- owned-reminder is enqueued at the claim and sends a business day
-- later, so it sat squarely inside that window: three were ever created,
-- and all three were cancelled within minutes — 26 seconds in one case.
-- Not one has ever been sent.
--
-- 'active' stays. A company that reached Listed has converted, and the
-- acquisition ladder has nothing left to say to it.
--
-- THE LISTED SERIES IS SPARED, because it is enqueued by the very event
-- that trips this trigger: enqueue_listed_series writes company-live and
-- friends when the company goes Listed, and advance_prospect_on_company_listed
-- moves the prospect to 'active' at the same moment. Today the ordering
-- happens to leave those rows alone. That is luck, not design, and the
-- one thing this trigger must never do is cancel the mail whose reason
-- for existing is the status it is reacting to.

CREATE OR REPLACE FUNCTION public.cancel_drips_on_prospect_advance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'active' AND NEW.company_id IS NOT NULL THEN
    UPDATE public.email_drip_queue
       SET cancelled_at = now(),
           cancelled_reason = 'status_change'
     WHERE company_id = NEW.company_id
       AND sent_at IS NULL
       AND cancelled_at IS NULL
       AND template NOT IN ('company-live', 'listed-professionals', 'listed-backlink');
  END IF;

  RETURN NEW;
END;
$function$;
