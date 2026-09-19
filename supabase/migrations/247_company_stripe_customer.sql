-- The Stripe customer for a company, known before it has a subscription.
--
-- Until now the only place a customer id was stored was the
-- subscriptions row, which is written after a subscription exists. So
-- every checkout attempt before that point looked the company up, found
-- nothing, and created another customer: one sandbox collected 114 of
-- them, and a single iDEAL payment made three. Worse, a mandate given on
-- one of those customers cannot be charged on another, which is how a
-- completed payment ended up reported as a failure.
--
-- Nullable and additive: existing rows are backfilled from the
-- subscriptions they already have, and anything without one is filled in
-- the first time a customer is created for it.

alter table public.companies
  add column if not exists stripe_customer_id text;

comment on column public.companies.stripe_customer_id is
  'Stripe customer for this company. Set when the customer is first created, before any subscription exists.';

-- One company per customer and one customer per company. A duplicate
-- here would mean two billing identities for the same business.
create unique index if not exists companies_stripe_customer_id_key
  on public.companies (stripe_customer_id)
  where stripe_customer_id is not null;

update public.companies c
set stripe_customer_id = s.stripe_customer_id
from public.subscriptions s
where s.company_id = c.id
  and c.stripe_customer_id is null;
