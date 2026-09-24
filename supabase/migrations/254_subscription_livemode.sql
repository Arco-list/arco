-- Which Stripe mode a mirrored subscription came from.
--
-- There is one database behind localhost, preview and arcolist.com, and
-- the checkout writes its own mirror row the moment the subscription
-- exists — deliberately, so the screen does not wait on a webhook. The
-- consequence was not deliberate: a checkout completed on a dev server
-- with test keys wrote an `active` row into the same table the live site
-- reads, and getCompanyBilling had no way to tell. Arco Testbedrijf sat
-- on Pro on arcolist.com against a payment that never happened.
--
-- The fix is not "test subscriptions never count" — on a dev server they
-- must, or the product cannot be tested. It is that a subscription only
-- counts where it belongs: the row records its mode, and the app
-- compares it to the mode of the key it is holding.
--
-- Default true because the column is added to an empty table and every
-- row after this carries an explicit value from Stripe. A row that
-- somehow arrives without one is treated as live, which fails towards
-- honouring a subscription rather than silently revoking one.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS livemode boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.subscriptions.livemode IS
  'Stripe''s own livemode flag on the subscription. Entitlement requires it to match the mode of the STRIPE_SECRET_KEY the app is running with, so a test-mode subscription cannot grant Pro on the live site and a live one cannot be read by a dev server.';
