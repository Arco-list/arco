-- 165_company_inherit_first_touch.sql
--
-- Extends set_company_onboarded_at so the company inherits its
-- owner's first_touch_source on the first draft→non-draft transition.
-- Idempotent: once set, never overwritten (re-listing a pro doesn't
-- re-attribute the company to whoever happens to own it later).

CREATE OR REPLACE FUNCTION public.set_company_onboarded_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  owner_source TEXT;
BEGIN
  IF (OLD.status = 'draft' AND NEW.status <> 'draft' AND NEW.onboarded_at IS NULL) THEN
    NEW.onboarded_at := now();
    -- Inherit first_touch_source from the owner's profile if we
    -- haven't already stamped it on this company. NULL owner_id or
    -- NULL owner first_touch_source leaves the company NULL, which is
    -- accurate ("unknown source").
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
$$;
