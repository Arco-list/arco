-- Outbound contact log + denormalized columns on prospects so the
-- admin/sales table can sort/filter on manual outbound activity
-- without a JOIN per row.
--
-- Manual touches (calls, meetings, manual emails, etc.) write one row
-- to outbound_contact_log. A trigger keeps prospects.last_outbound_at
-- in sync — notes are excluded because they're context, not contact.
-- prospects.next_follow_up_at is set by the rep through the Log
-- outbound modal (no automation around it).

CREATE TYPE outbound_kind AS ENUM ('call', 'meeting', 'email', 'linkedin', 'note');
CREATE TYPE outbound_outcome AS ENUM ('positive', 'neutral', 'negative', 'no_answer');

CREATE TABLE public.outbound_contact_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  kind        outbound_kind NOT NULL,
  outcome     outbound_outcome,
  body        text
);
CREATE INDEX idx_outbound_log_prospect_created
  ON public.outbound_contact_log(prospect_id, created_at DESC);

ALTER TABLE public.prospects
  ADD COLUMN last_outbound_at  timestamptz,
  ADD COLUMN next_follow_up_at timestamptz;

CREATE INDEX idx_prospects_next_follow_up_at
  ON public.prospects(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX idx_prospects_last_outbound_at
  ON public.prospects(last_outbound_at) WHERE last_outbound_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_prospect_last_outbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind != 'note' THEN
    UPDATE public.prospects
    SET last_outbound_at = NEW.created_at
    WHERE id = NEW.prospect_id
      AND (last_outbound_at IS NULL OR last_outbound_at < NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_outbound_log_update_last_outbound
AFTER INSERT ON public.outbound_contact_log
FOR EACH ROW EXECUTE FUNCTION public.update_prospect_last_outbound();

-- RLS: locked down. All writes go through server actions using the
-- service-role client (admin-only via app/[locale]/admin/layout.tsx).
ALTER TABLE public.outbound_contact_log ENABLE ROW LEVEL SECURITY;
-- No policies = no client access. Reads happen server-side via service role.
