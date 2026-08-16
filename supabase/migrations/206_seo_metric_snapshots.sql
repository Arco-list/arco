-- 206: daily SEO metric snapshots.
--
-- seo_impressions_28d / seo_clicks_28d on companies + projects are
-- rolling-window values overwritten by every nightly GSC sync — no
-- history survives, so the growth dashboards could only show the
-- current window in the last bucket. One row per (day, scope) captures
-- the aggregate totals so earlier buckets can be reconstructed from
-- the snapshot nearest each bucket end. Written by
-- /api/cron/sync-gsc-indexation after each successful sync.

CREATE TABLE IF NOT EXISTS public.seo_metric_snapshots (
  snapshot_date date NOT NULL,
  scope text NOT NULL CHECK (scope IN ('projects', 'companies')),
  impressions_28d integer NOT NULL DEFAULT 0,
  clicks_28d integer NOT NULL DEFAULT 0,
  indexed_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (snapshot_date, scope)
);

ALTER TABLE public.seo_metric_snapshots ENABLE ROW LEVEL SECURITY;

-- Read-only for signed-in users (the admin dashboard reads with the
-- user-context client); writes go through the service role only.
CREATE POLICY "seo_metric_snapshots_select_authenticated"
  ON public.seo_metric_snapshots FOR SELECT
  TO authenticated
  USING (true);
