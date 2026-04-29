-- History of Apollo sync runs.
--
-- Two kinds of sync drive the /admin/sales sales funnel:
--   • 'list'     — pulls contacts from an Apollo list into prospects (manual,
--                  triggered when adding new contacts in Apollo)
--   • 'activity' — refreshes campaign status for existing prospects (cron,
--                  with a manual "Refresh now" escape hatch)
--
-- Logging each run lets the Apollo Sync popup surface "last cron run was
-- 2h ago, succeeded, refreshed 25/29 prospects" without pulling state from
-- a 3rd-party log aggregator. One row per run; oldest rows can be pruned
-- by a future retention job, but for the first 12 months volume is tiny
-- (cron every 6h × 2 kinds = ~4 rows/day).

CREATE TABLE IF NOT EXISTS public.apollo_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('list', 'activity')),
  triggered_by text NOT NULL CHECK (triggered_by IN ('manual', 'cron')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  /** For 'list': contacts upserted. For 'activity': prospects updated. */
  synced_count integer,
  /** Total considered (e.g. activity sync iterates N prospects). */
  total_count integer,
  error_count integer NOT NULL DEFAULT 0,
  /** Last error message, if any. NULL on full success. */
  last_error text,
  /** Apollo list_id when kind='list'. NULL otherwise. */
  list_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.apollo_sync_runs IS
  'One row per Apollo sync invocation (list import or activity refresh). Surfaced in the Apollo Sync popup on /admin/sales.';

CREATE INDEX IF NOT EXISTS idx_apollo_sync_runs_kind_started
  ON public.apollo_sync_runs (kind, started_at DESC);

-- RLS: admin-only. Service role bypasses RLS so cron + server actions can
-- still write; anonymous and authenticated roles can't see anything.
ALTER TABLE public.apollo_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read apollo_sync_runs" ON public.apollo_sync_runs;
CREATE POLICY "admins read apollo_sync_runs"
  ON public.apollo_sync_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND ('admin' = ANY (p.user_types) OR p.admin_role IS NOT NULL)
    )
  );
