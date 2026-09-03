-- Which funnel issued the token. Drives channel-specific copy on /claim
-- (invite shows the credit + roster; showcase the page we built;
-- outreach the empty-state lookups) without inferring it from data shape.
ALTER TABLE public.claim_tokens
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'invite';
