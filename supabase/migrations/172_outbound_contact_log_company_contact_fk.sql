-- Add company_contact_id to outbound_contact_log alongside the existing
-- prospect_id. After the app cutover (migration 174) we'll drop prospect_id
-- and make company_contact_id NOT NULL; for now both coexist so legacy code
-- keeps writing prospect_id while new code can target company_contact_id.

ALTER TABLE public.outbound_contact_log
  ADD COLUMN company_contact_id uuid REFERENCES public.company_contacts(id)
    ON DELETE CASCADE;

ALTER TABLE public.outbound_contact_log
  ALTER COLUMN prospect_id DROP NOT NULL;

-- Exactly one of the two FKs must be populated. Removes ambiguity about
-- whether a log row attaches to a (person, company) pair or a legacy
-- prospect record.
ALTER TABLE public.outbound_contact_log
  ADD CONSTRAINT outbound_contact_log_one_target CHECK (
    (prospect_id IS NOT NULL)::int + (company_contact_id IS NOT NULL)::int = 1
  );

CREATE INDEX outbound_contact_log_company_contact_id_idx
  ON public.outbound_contact_log (company_contact_id)
  WHERE company_contact_id IS NOT NULL;
