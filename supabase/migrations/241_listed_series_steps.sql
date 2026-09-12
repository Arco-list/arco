-- ═══════════════════════════════════════════════════════════════════════
-- 241: Listed-series trigger sets explicit steps (constraint fix)
-- ═══════════════════════════════════════════════════════════════════════
-- email_drip_queue has a UNIQUE (user_id, sequence, step) and step
-- defaults to 1 — the 237 trigger inserted both series rows without a
-- step, so the second insert would violate the constraint and, being
-- inside an AFTER trigger, abort the LISTING UPDATE itself. Surfaced
-- while backfilling Linda Exclusieve Tuinen by hand. Steps 1/2, plus
-- ON CONFLICT DO NOTHING so a re-flip can never break a listing.

CREATE OR REPLACE FUNCTION enqueue_listed_series()
RETURNS trigger AS $$
DECLARE
  v_email text;
BEGIN
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.owner_id;
  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.email_drip_queue
    WHERE company_id = NEW.id AND template = 'company-live'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.email_drip_queue (email, user_id, template, sequence, step, company_id, send_at, variables)
  VALUES (v_email, NEW.owner_id, 'company-live', 'listed-series', 1, NEW.id, now(),
    jsonb_build_object('company_name', NEW.name))
  ON CONFLICT (user_id, sequence, step) DO NOTHING;

  INSERT INTO public.email_drip_queue (email, user_id, template, sequence, step, company_id, send_at, variables)
  VALUES (v_email, NEW.owner_id, 'listed-professionals', 'listed-series', 2, NEW.id, public.next_business_send(3),
    jsonb_build_object('company_name', NEW.name))
  ON CONFLICT (user_id, sequence, step) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
