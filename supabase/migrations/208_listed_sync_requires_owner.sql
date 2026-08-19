-- 'active' in the prospects funnel means CONVERTED — the company was
-- claimed and listed by its owner. An admin toggling an unclaimed
-- showcase company to 'listed' must not promote its contacts: guard the
-- sync on owner_id.
CREATE OR REPLACE FUNCTION sync_prospects_with_company_status()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'listed' AND NEW.owner_id IS NOT NULL THEN
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
$$ LANGUAGE plpgsql;
