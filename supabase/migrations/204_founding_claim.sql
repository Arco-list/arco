-- 204: founding-member claim timestamp.
--
-- The pricing page's Pro CTA ("Claim Pro for free") collects the
-- pre-payments willingness-to-pay signal. PostHog gets an
-- upgrade_intent event, but the durable, per-company record lives
-- here: who claimed founding access and when. Doubles as the counter
-- behind the "first 100 companies keep this price" promise.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS founding_claimed_at timestamptz;

COMMENT ON COLUMN public.companies.founding_claimed_at IS
  'When the company claimed founding-member (Pro-free) access from the pricing page. NULL = never claimed. First 100 non-null rows keep the founding price.';
