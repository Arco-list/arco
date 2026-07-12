-- prospects_email_source_key was a plain UNIQUE (email, source). Now
-- that Added → Showcased no longer requires a contact email, the
-- server-action inserts a placeholder empty string:
--
--     insert({ email: company.email ?? "", source: "arco", ... })
--
-- The first company with no email lands fine; every subsequent one
-- collides on ("", "arco") and the insert fails silently, leaving
-- the company at status='prospected' but absent from Sales.
--
-- Fix: relax the constraint to a PARTIAL unique index — uniqueness
-- only enforced when email is not empty. Real dedup semantics
-- (same email imported twice from arco or apollo) are preserved;
-- placeholder empties can coexist while Sales captures the real
-- address.
--
-- Once the Sales page's "Add/Change contact email" feature ships,
-- writing a real email will still enforce uniqueness.

ALTER TABLE public.prospects
  DROP CONSTRAINT IF EXISTS prospects_email_source_key;

CREATE UNIQUE INDEX prospects_email_source_uniq
  ON public.prospects (email, source)
  WHERE email <> '';
