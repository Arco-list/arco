-- Remembering that a company did not pay.
--
-- Our checkout grants Pro on a mandate, before any money has moved.
-- That is deliberate: a SEPA debit takes days, and an honest buyer
-- should not wait for what they have just bought. `past_due` sits in
-- the entitlement set for exactly that reason.
--
-- It is also a loophole. Give a mandate on an empty account, take Pro
-- immediately, let the debit fail, keep Pro through the whole dunning
-- window, get cancelled, and start again minutes later with a fresh
-- mandate. The cost of a cycle is one IBAN; the yield is unlimited Pro.
--
-- Closing it does not mean withdrawing the trust — it means earning it.
-- Two facts have to survive for that, and neither did:
--
--   * `subscriptions` is upserted on company_id, so re-subscribing
--     overwrites every trace of the subscription that failed. The
--     company's own row is the only place a memory outlives that.
--
--   * "Has this subscription ever been paid?" cannot be read from a
--     status. `past_due` looks identical whether it is a first debit
--     travelling or a renewal that failed after two years of payments,
--     and those two deserve opposite answers.
--
-- So: a counter that survives, and a stamp that says this particular
-- subscription has been good for its money at least once.

alter table public.companies
  add column if not exists nonpayment_cancellations integer not null default 0;

comment on column public.companies.nonpayment_cancellations is
  'How many times a subscription for this company was cancelled by Stripe for non-payment. Above zero, a new subscription no longer gets Pro on the strength of a mandate alone — it waits for the first payment to clear.';

alter table public.subscriptions
  add column if not exists first_payment_at timestamptz;

comment on column public.subscriptions.first_payment_at is
  'When this subscription was first seen active or trialing, i.e. when its money actually arrived. Until it is set, the subscription has never been paid for, and a company with a history of non-payment gets no access on credit.';
