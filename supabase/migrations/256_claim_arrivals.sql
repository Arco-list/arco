-- Arriving at the claim page, recorded where every channel can be read
-- the same way.
--
-- The Pro visitors row used to count PostHog sessions that touched
-- /businesses, while the rates underneath it divided by server-side
-- click logs. Two systems, two units, one percentage — which is how a
-- row could read 19 visitors above a rate computed on 1.
--
-- Moving the step to /claim dissolves that, because /claim already
-- knows the channel at the door: a signed token carries it, and its
-- absence is the platform route. One event, one table, one unit for
-- Invites, Sales and Organic alike. No cookie and no consent question
-- either — this is a request arriving, not something stored on anyone's
-- device.
--
-- It also measures the right thing. /businesses/architects is a
-- marketing page you can reach by accident; "put your firm on Arco" is
-- a button you press on purpose.
--
-- EMAIL IS NULL FOR THE PLATFORM ROUTE, and that is the honest gap: a
-- tokenless arrival has no identity, so those rows count page loads
-- rather than people while the token channels count distinct addresses.
-- Deduplicating anonymous arrivals needs either a cookie (consent) or
-- an IP-derived key (a decision about personal data), and neither is
-- worth making silently.

CREATE TABLE IF NOT EXISTS public.claim_arrivals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'invite' | 'outreach' | 'showcase' | 'platform'. Mirrors
  -- claim_tokens.channel; 'platform' is the tokenless route.
  channel text NOT NULL,
  -- The address the token was issued to. NULL for the platform route.
  email text,
  -- The company being claimed, when the token names one.
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The funnel reads this by period and by channel, always in that order.
CREATE INDEX IF NOT EXISTS idx_claim_arrivals_created_channel
  ON public.claim_arrivals (created_at DESC, channel);

-- Distinct-email-per-period is the unique count for the token channels.
CREATE INDEX IF NOT EXISTS idx_claim_arrivals_email
  ON public.claim_arrivals (email)
  WHERE email IS NOT NULL;

ALTER TABLE public.claim_arrivals ENABLE ROW LEVEL SECURITY;

-- Written by the service role from the /claim server component, read by
-- admin reporting through the service role. No policy for anon or
-- authenticated: nothing in the product needs to see this, and an
-- arrival log is exactly the kind of table that should not be readable
-- by the people it records.
COMMENT ON TABLE public.claim_arrivals IS
  'One row per arrival on /claim, with the channel taken from the claim token (or ''platform'' when there is none). The Pro visitors funnel step. Mail-scanner hits are filtered out before insert by isLikelyMailScannerVisit.';
