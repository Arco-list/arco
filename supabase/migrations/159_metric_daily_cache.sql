-- 159_metric_daily_cache.sql
--
-- Daily snapshot cache for PostHog-sourced growth metrics. Populated
-- by /api/cron/sync-growth-metrics on a nightly schedule (and on-demand
-- via the manual sync button on /admin/growth/model).
--
-- Why daily granularity for a monthly-view page: the Growth Model
-- displays months but we keep daily rows so future per-week / per-day
-- views can read from the same cache without a second sync pipeline.
-- Monthly aggregation is a SUM at query time — cheap, since each metric
-- has at most ~365 rows per year.
--
-- Why a cache at all: PostHog HogQL queries for 8+ months of visitor
-- counts take 1–3 seconds; the Lifecycle dashboard already shows a
-- "PostHog unavailable" fallback because of this. Caching also gives
-- us immutable historical baselines once we add forecast / scenario
-- planning on top of this page.

CREATE TABLE public.metric_daily_cache (
  -- Composite primary key: one row per (metric, day).
  metric_key text NOT NULL,
  day date NOT NULL,
  value bigint NOT NULL,

  -- When this row was last refreshed. Sync re-fetches the rolling 30
  -- days on every run, so synced_at on any given row tells us "this
  -- value reflects PostHog state as of synced_at" — useful for the
  -- manual sync button's last-synced timestamp display.
  synced_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (metric_key, day)
);

-- Per-metric lookups: "give me the last N days for client_visitors".
CREATE INDEX idx_metric_daily_cache_metric_day
  ON public.metric_daily_cache (metric_key, day DESC);

-- Per-day lookups for cross-metric joins (future "all metrics for a
-- given day" queries on /admin/growth dashboards).
CREATE INDEX idx_metric_daily_cache_day
  ON public.metric_daily_cache (day);

COMMENT ON TABLE public.metric_daily_cache IS
  'Daily snapshot of PostHog-sourced growth metrics. Re-synced on rolling 30-day window by /api/cron/sync-growth-metrics. Older rows are effectively immutable since PostHog identity merges resolve within ~14 days.';
