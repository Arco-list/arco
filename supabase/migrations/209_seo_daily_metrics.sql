-- True daily GSC impressions/clicks per scope (page-path filtered).
-- The 28d rolling snapshots stay for point-in-time counts; this table
-- exists so weekly/monthly dashboard buckets can show real per-period
-- sums instead of overlapping rolling windows.
CREATE TABLE IF NOT EXISTS seo_daily_metrics (
  metric_date date NOT NULL,
  scope text NOT NULL,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  PRIMARY KEY (metric_date, scope)
);
ALTER TABLE seo_daily_metrics ENABLE ROW LEVEL SECURITY;
