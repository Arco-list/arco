-- The non-payment memory is a record again, not a gate.
--
-- 251 added these two columns to close a loop: Pro is granted on a
-- mandate, so a mandate on an empty account bought the product until
-- the debit failed, and starting over bought it again. The counter
-- withheld that credit from anyone who had already done it once.
--
-- The rule worked. It was still the wrong trade, and the other half of
-- 251 is why: cancelling a first period the moment its payment fails
-- cut the free ride from three weeks of dunning to the days a debit
-- spends in transit. What was left asked a fraudster to re-enter a
-- mandate every few days, indefinitely, to avoid €49 a month — and the
-- price of guarding against it was two more parameters in the function
-- that decides whether a company may use what it has paid for. That
-- function should be as dull as we can make it; being wrong there turns
-- a paying customer away.
--
-- So the counting stays and the gate goes. The evidence is worth
-- keeping — if this stops being hypothetical, the column is already
-- populated and the gate is an hour's work.
--
-- Only the comments change. Both columns are still written: the counter
-- by the webhook on a non-payment cancellation, and first_payment_at by
-- the mirror, which the webhook reads to tell a first payment from a
-- renewal. That distinction is load-bearing — it is what makes a
-- declined signup end the subscription while a declined renewal keeps
-- the product on through dunning.

comment on column public.companies.nonpayment_cancellations is
  'How many times a subscription for this company was cancelled by Stripe for non-payment. Recorded, not enforced: nothing reads it to decide access. Kept so that abuse, if it ever appears, can be seen rather than guessed at.';

comment on column public.subscriptions.first_payment_at is
  'When this subscription was first seen active or trialing, i.e. when its money actually arrived. Set once and never moved. Read to tell a first payment from a renewal: a first payment that fails ends the subscription on the spot, while a renewal that fails runs the full dunning schedule with the product still on.';
