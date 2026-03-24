-- Domain verification codes table (replaces Redis-based storage)
CREATE TABLE IF NOT EXISTS public.domain_verification_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One active code per user+domain pair
CREATE UNIQUE INDEX idx_domain_verification_user_domain
  ON public.domain_verification_codes(user_id, domain);

-- RLS: no direct client access (service role only)
ALTER TABLE public.domain_verification_codes ENABLE ROW LEVEL SECURITY;
