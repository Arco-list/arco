-- Claim funnel (platform channel): domain-verification codes for
-- visitors who do not have an account yet. domain_verification_codes
-- cannot serve here — its user_id FK requires an auth.users row, and
-- the flipped platform verification proves the mailbox BEFORE any
-- account exists. Keyed on (email, domain); service-role access only.

create table if not exists public.claim_email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  domain text not null,
  code text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (email, domain)
);

alter table public.claim_email_verification_codes enable row level security;
-- No policies on purpose: only the service role reads or writes codes.
