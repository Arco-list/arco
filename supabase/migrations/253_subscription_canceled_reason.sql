-- Why a subscription ended, not just that it did.
--
-- The checkout offers a returning customer the mandate we already hold,
-- so they do not have to find their IBAN again. Sensible — except when
-- the mandate on file is the one whose debit just bounced, and the
-- subscription was cancelled because of it. Then the fastest path
-- through the form is the one most likely to fail again, and it was
-- preselected.
--
-- Saying so needs a fact we were not keeping. `status = 'canceled'`
-- covers both someone who chose to leave and someone whose payments
-- failed, and the difference is the whole point: one of those mandates
-- is fine and the other is not. Guessing from
-- companies.nonpayment_cancellations would put a red warning on a
-- working payment method for anyone who once failed and later
-- cancelled on purpose — pushing them to re-enter details that were
-- never the problem.
--
-- Stripe has the answer in cancellation_details.reason, which is also
-- what the webhook already reads to count non-payments. This stores it,
-- so the checkout can ask our own row rather than Stripe on every
-- render.

alter table public.subscriptions
  add column if not exists canceled_reason text;

comment on column public.subscriptions.canceled_reason is
  'Stripe cancellation_details.reason, verbatim: cancellation_requested when someone chose to leave, payment_failed when Stripe gave up collecting. Null while the subscription is alive.';
