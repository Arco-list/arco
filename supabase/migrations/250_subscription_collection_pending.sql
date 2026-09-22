-- Access while a repair payment is travelling.
--
-- Our own entitlement rule already grants Pro to a `past_due`
-- subscription, and that is not generosity: when a new subscriber pays
-- by SEPA, Stripe marks the subscription past_due for the two to five
-- working days the debit is in transit. Taking the product away for
-- those days would punish people for using the payment method we steer
-- them towards.
--
-- The same thing happens on the way back from `unpaid`, and there we
-- did take it away. Somebody whose collection had failed, who then gave
-- us a working mandate and set a fresh debit travelling, sat on Free
-- while it cleared — and the screen said so in two contradictory
-- breaths: the plan read "Gratis" above a sentence promising "volledige
-- toegang", beside a button offering to upgrade to what they had just
-- paid for.
--
-- What should decide is whether money is actually moving, not which
-- label the subscription happens to carry. Stripe keeps the status at
-- `unpaid` until the money lands, which is correct bookkeeping and the
-- wrong answer to "may they use the product this week".
--
-- So: a deadline, written when a repair payment starts travelling.
-- Deliberately not a boolean. A flag that is only ever cleared by the
-- webhook confirming success would, on a failure nobody hears about,
-- grant Pro forever. A timestamp expires on its own, which makes the
-- worst case a few days of unpaid access rather than an unbounded
-- grant.
--
-- And deliberately not written into `status`. That column holds
-- Stripe's own statuses verbatim; recording a `past_due` Stripe never
-- said would have reused the existing entitlement set at the cost of
-- putting a fiction in the mirror, where the next webhook would
-- silently overwrite it.

alter table public.subscriptions
  add column if not exists collection_pending_until timestamptz;

comment on column public.subscriptions.collection_pending_until is
  'While in the future, a payment is in transit for this subscription and access is granted even though Stripe still reads unpaid. Set when a replaced payment method starts collecting an open invoice; expires on its own if the money never arrives.';
