-- ═══════════════════════════════════════════════════════════════════════
-- 140: Email stats cache
-- ═══════════════════════════════════════════════════════════════════════
-- Stores aggregated email stats per template so the admin/emails page
-- can render instantly from cache, then refresh from Resend in the
-- background.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE public.email_stats_cache (
  template_id text PRIMARY KEY,
  sends integer NOT NULL DEFAULT 0,
  delivered integer NOT NULL DEFAULT 0,
  opened integer NOT NULL DEFAULT 0,
  clicked integer NOT NULL DEFAULT 0,
  bounced integer NOT NULL DEFAULT 0,
  cached_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_stats_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_stats_cache_admin_all" ON public.email_stats_cache
  FOR ALL USING (public.is_admin_user());
