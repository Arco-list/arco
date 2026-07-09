-- Change prospects.company_id → companies.id from NO ACTION to SET NULL.
--
-- Symptom: deleting a company fails with a FK violation when a prospect
-- row references it (typical for companies whose owner signed up via an
-- outbound sequence — Niek's row for Olli, for instance).
--
-- Semantics: a prospect row records outreach history and should survive
-- the company being deleted. SET NULL keeps the audit trail (who we
-- emailed, when, delivery outcomes) while unlinking it from a company
-- that no longer exists.

ALTER TABLE public.prospects
  DROP CONSTRAINT IF EXISTS prospects_company_id_fkey;

ALTER TABLE public.prospects
  ADD CONSTRAINT prospects_company_id_fkey
  FOREIGN KEY (company_id)
  REFERENCES public.companies(id)
  ON DELETE SET NULL;
