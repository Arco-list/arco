-- De trigger die opruimt zodra een bedrijf live gaat, kende de tweede
-- Visitor-mail nog niet.
--
-- advance_prospect_on_company_listed annuleert elke wachtende mail die
-- door het live gaan is ingehaald. Die lijst werd met de hand
-- bijgehouden, en toen 'visitor-nudge-2' erbij kwam is hij hier niet
-- bijgewerkt. Gevolg: stap 1 werd geannuleerd, stap 2 bleef staan en
-- zou dagen later alsnog iemand uitnodigen zijn pagina te claimen die
-- al geclaimd en live is.
--
-- De cron ving dat bij verzenden af (stage gate), maar pas op het
-- laatste moment: tot dan stond er een Scheduled-regel in de
-- contactkaart die nooit ging vertrekken.

CREATE OR REPLACE FUNCTION public.advance_prospect_on_company_listed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

  IF v_id IS NOT NULL THEN
    UPDATE public.prospects
    SET status = 'active',
        sequence_status = 'finished',
        converted_at = COALESCE(converted_at, now())
    WHERE id = v_id;

    INSERT INTO public.prospect_events (prospect_id, event_type, event_source, old_status, new_status, metadata)
    VALUES (v_id, 'status_change', 'db', v_old::prospect_status, 'active',
      jsonb_build_object('via', 'company_listed', 'company_id', NEW.id));
  END IF;

  UPDATE public.email_drip_queue q
  SET cancelled_at = now(), cancelled_reason = 'status_change'
  WHERE q.sent_at IS NULL AND q.cancelled_at IS NULL
    AND q.template IN (
      'outreach-intro','outreach-followup','outreach-final',
      'prospect-intro','prospect-followup','prospect-final',
      'new-professional-invite','new-professional-followup','new-professional-final',
      'visitor-nudge','visitor-nudge-2','verified-reminder','owned-welcome')
    AND (q.company_id = NEW.id
         OR lower(q.email) IN (SELECT lower(p2.email) FROM public.prospects p2 WHERE p2.company_id = NEW.id));

  RETURN NEW;
END;
$$;
