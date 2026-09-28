-- Give claim_arrivals the history it was born without.
--
-- The table started on 26 September, so every conversion that divides
-- by it reads ~0% for the six months before that. Meanwhile two older
-- ledgers have been recording the same fact all along: a pro reached
-- the landing.
--
--   prospect_events 'prospect.landing_visited'   313 rows, from 29 Mar
--   project_professionals.landing_visited_at       4 rows, from 23 Apr
--
-- Those answer the same question in two places — the pattern that made
-- Pro visitors read one number on the dashboard and another on the
-- model. This copies both into the one ledger the funnel reads, so the
-- phrase "Pro visitor" finally means a single thing.
--
-- NOT A REPLACEMENT. The old ledgers keep being written and keep
-- serving Sales' own columns (last contacted, the prospect timeline).
-- What changes is only where the funnel counts from.

-- ── Idempotency ──────────────────────────────────────────────────────
-- A backfill that cannot be re-run is a backfill you are afraid to fix.
-- source_ref names the row this came from, so a second run collides
-- instead of doubling, and `delete where source_ref is not null` undoes
-- the whole thing without touching a single real arrival.
ALTER TABLE public.claim_arrivals
  ADD COLUMN IF NOT EXISTS source_ref text;

COMMENT ON COLUMN public.claim_arrivals.source_ref IS
  'Set only on rows imported by migration 259 from the older landing ledgers: pe:<prospect_event id> or pp:<project_professionals id>. NULL means the row was written live by /claim.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_arrivals_source_ref
  ON public.claim_arrivals (source_ref)
  WHERE source_ref IS NOT NULL;

-- ── The cutoff ───────────────────────────────────────────────────────
-- Both ledgers were still writing when claim_arrivals started, and on
-- 27 September both recorded the same landings. Everything from the
-- first live row onward is already here; only what came before it is
-- missing. Importing past that line would count those days twice.

-- ── 1. The click log ─────────────────────────────────────────────────
-- Taken first because it is the fuller ledger, and because it carries
-- the prospect's own channel. The mapping mirrors resolveClaimChannel:
-- 'arco' is the showcase pitch, 'invites' a credited pro, everything
-- else the cold outreach track.
INSERT INTO public.claim_arrivals (channel, email, company_id, created_at, source_ref)
SELECT
  CASE p.source::text
    WHEN 'arco'    THEN 'showcase'
    WHEN 'invites' THEN 'invite'
    ELSE 'outreach'
  END,
  lower(p.email),
  p.company_id,
  ev.created_at,
  'pe:' || ev.id
FROM public.prospect_events ev
JOIN public.prospects p ON p.id = ev.prospect_id
WHERE ev.event_type = 'prospect.landing_visited'
  AND p.email IS NOT NULL
  AND ev.created_at < (SELECT COALESCE(min(created_at), now())
                       FROM public.claim_arrivals WHERE source_ref IS NULL)
ON CONFLICT (source_ref) WHERE source_ref IS NOT NULL DO NOTHING;

-- ── 2. The credit ledger, only where the click log is silent ─────────
-- Two of its four rows describe a landing the click log already has —
-- the same person, the same day, recorded by both. Inserting both would
-- inflate Invites by half on a row that only ever had four.
INSERT INTO public.claim_arrivals (channel, email, company_id, created_at, source_ref)
SELECT 'invite', lower(pp.invited_email), pp.company_id, pp.landing_visited_at, 'pp:' || pp.id
FROM public.project_professionals pp
WHERE pp.landing_visited_at IS NOT NULL
  AND pp.invited_email IS NOT NULL
  AND pp.landing_visited_at < (SELECT COALESCE(min(created_at), now())
                               FROM public.claim_arrivals WHERE source_ref IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.claim_arrivals ca
    WHERE ca.email = lower(pp.invited_email)
      AND ca.created_at::date = pp.landing_visited_at::date
  )
ON CONFLICT (source_ref) WHERE source_ref IS NOT NULL DO NOTHING;
