-- Claim tokens: signed, single-use entry into the new company signup
-- funnel (/claim). Separate from the accept-token (lib/invites/
-- accept-token.ts) on purpose: that one authorises a bounded act on one
-- credit and is stateless/replayable; this one ends in a minted session,
-- so replay is not harmless and single-use needs state.
--
-- The HMAC binds (id, company_id, email, expiry); this table is the
-- state side: issuance record + consumed_at. Consumption is a
-- conditional UPDATE (consumed_at IS NULL) — the same claim-before-act
-- lock the invite dispatcher uses, so two concurrent completions cannot
-- both create an account.

CREATE TABLE IF NOT EXISTS public.claim_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- The credit that carried the invite, when there is one (Invite
  -- channel). Null for Showcase/Outreach/self-serve issuance later.
  credit_id   uuid REFERENCES public.project_professionals(id) ON DELETE SET NULL,
  email       text NOT NULL,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_tokens_company ON public.claim_tokens(company_id);

-- Service-role only: issued and verified server-side, never queried by
-- the browser.
ALTER TABLE public.claim_tokens ENABLE ROW LEVEL SECURITY;
