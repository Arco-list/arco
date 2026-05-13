-- 160_metric_cache_multi_granularity.sql
--
-- Replaces 159's metric_daily_cache with a multi-granularity shape
-- (day / week / month / year). Each PostHog metric is synced 4 times
-- — once per granularity — so reads at any bucket size return *true*
-- uniques instead of overcounted sums-of-daily-uniques.
--
-- Why this matters: summing daily-unique visitor counts into a month
-- double-counts anyone who returned across multiple days. A single
-- visitor active on 3 days of March looks like 3 monthly visitors
-- when you sum the daily rows. PostHog computes uniques natively
-- per requested bucket, so we cache one row per (metric, bucket).
--
-- 159's table is dropped without ceremony — it had no production data
-- (no cron run had populated it yet).

DROP TABLE IF EXISTS public.metric_daily_cache;

CREATE TABLE public.metric_cache (
  -- Composite primary key. period_start is the bucket boundary in
  -- UTC at the appropriate granularity:
  --   day   → the date itself
  --   week  → Monday of the ISO week
  --   month → first day of the month
  --   year  → January 1st of the year
  metric_key text NOT NULL,
  granularity text NOT NULL CHECK (granularity IN ('day','week','month','year')),
  period_start date NOT NULL,
  value bigint NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (metric_key, granularity, period_start)
);

-- Primary lookup: "last N periods of metric X at granularity Y".
CREATE INDEX idx_metric_cache_lookup
  ON public.metric_cache (metric_key, granularity, period_start DESC);

COMMENT ON TABLE public.metric_cache IS
  'PostHog-sourced growth metrics cached at day/week/month/year granularity. Re-synced by /api/cron/sync-growth-metrics nightly + on manual sync. Each granularity stores PostHog-native uniques (no JS aggregation), so monthly views return true monthly uniques rather than summed daily-uniques.';
