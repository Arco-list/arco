-- ═══════════════════════════════════════════════════════════════════════
-- 245: subscriptions — the local mirror of Stripe Billing
-- ═══════════════════════════════════════════════════════════════════════
-- Stripe holds the truth about money; this table is the copy the product
-- reads so that rendering a dashboard never depends on a network call to
-- Stripe. Webhooks keep it in step (see app/api/webhooks/stripe).
--
-- Deliberately NOT a new value on company_status. Billing state and
-- marketplace state are different axes: a company can be listed and
-- unpaid, or subscribed and unlisted. The admin funnel's "Subscribed"
-- card derives its count from this table instead.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- One subscription per company. A second one would mean two sources of
  -- truth about the same entitlements.
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,

  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,

  -- Stripe's own vocabulary, stored verbatim: trialing, active, past_due,
  -- canceled, unpaid, incomplete, incomplete_expired, paused. Kept as
  -- text rather than an enum so a new Stripe status never breaks the
  -- webhook — an unknown status is better than a rejected write.
  status text NOT NULL,

  stripe_price_id text,
  -- 'month' | 'year'. Denormalised from the price so the dashboard can
  -- say "billed annually" without a second lookup.
  billing_interval text,

  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  trial_end timestamptz,
  canceled_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_company_idx ON public.subscriptions(company_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_customer_idx ON public.subscriptions(stripe_customer_id);

-- ── Webhook idempotency ────────────────────────────────────────────────
-- Stripe retries, replays and occasionally delivers out of order. Every
-- handled event id lands here first; a duplicate insert is the signal to
-- skip. Without this, a retried invoice.paid can double-apply.
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id text PRIMARY KEY,                 -- Stripe's evt_… id
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error text
);

CREATE INDEX IF NOT EXISTS stripe_events_type_idx ON public.stripe_events(type);

-- ── RLS ────────────────────────────────────────────────────────────────
-- Writes belong to the webhook (service role) alone. Reads are for the
-- company's own people: the owner, or an active contact on that company.
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own company subscription readable" ON public.subscriptions;
CREATE POLICY "own company subscription readable"
  ON public.subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = subscriptions.company_id
        AND c.owner_id = auth.uid()
    )
  );

-- stripe_events carries no policy at all: service role bypasses RLS, and
-- nobody else has any business reading it.

COMMENT ON TABLE public.subscriptions IS
  'Local mirror of Stripe Billing subscriptions. Written only by the Stripe webhook; Stripe remains the source of truth.';
COMMENT ON TABLE public.stripe_events IS
  'Processed Stripe webhook event ids, for idempotency against retries and replays.';
