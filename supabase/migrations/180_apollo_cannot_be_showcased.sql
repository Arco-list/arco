-- Enforce the invariant: Apollo cold-imported companies (source='apollo')
-- can never sit at status='prospected' (Showcased). Showcased is the
-- admin-curated public marketplace state; Apollo prospects live only in
-- the outreach pipeline and appear on /admin/sales until they claim
-- (at which point they graduate to draft/listed via the normal flow).
--
-- Prior state: 61 Apollo companies had been auto-flipped to prospected
-- and were rendering on /professionals as empty stubs. Backfilled to
-- 'added' before this constraint lands.

ALTER TABLE public.companies
  ADD CONSTRAINT companies_apollo_not_showcased
  CHECK (NOT (source = 'apollo' AND status = 'prospected'));
