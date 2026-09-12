-- ═══════════════════════════════════════════════════════════════════════
-- 240: Listing also retires the sequences it overtook
-- ═══════════════════════════════════════════════════════════════════════
-- 239 promoted the owner's prospect to 'active' on the first listing
-- but left two loose ends (Linda Collignon showed both): the stored
-- sequence_status flag stayed 'active' with nothing queued, and any
-- still-pending pre-listing mails for the company (a co-contact's
-- outreach, an unsent visitor-nudge/verified-reminder/owned-reminder)
-- kept sitting "Scheduled" until the send-time gates reached the same
-- verdict. Replace the trigger function: promotion now also flips the
-- flag, and every overtaken pending row for the company — matched by
-- company_id or by any of its prospects' emails — is cancelled the
-- moment the listing happens.

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

  -- Retire every pending pre-listing mail for this company: the claim
  -- series for any of its contacts, and the stage mails the listing
  -- just made moot. The Listed serie (company-live etc.) is untouched.
  UPDATE public.email_drip_queue q
  SET cancelled_at = now(), cancelled_reason = 'status_change'
  WHERE q.sent_at IS NULL AND q.cancelled_at IS NULL
    AND q.template IN (
      'outreach-intro','outreach-followup','outreach-final',
      'prospect-intro','prospect-followup','prospect-final',
      'new-professional-invite','new-professional-followup','new-professional-final',
      'visitor-nudge','verified-reminder','owned-welcome')
    AND (q.company_id = NEW.id
         OR lower(q.email) IN (SELECT lower(p2.email) FROM public.prospects p2 WHERE p2.company_id = NEW.id));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
