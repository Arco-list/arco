-- Fix Supabase security advisor errors:
--
-- 1. Three views (project_search_documents, professional_search_documents,
--    company_metrics) were created without `security_invoker = true`, so they
--    run with the privileges of the view owner instead of the querying user.
--    Switching them to security_invoker makes them honor the caller's RLS.
--
-- 2. The posthog_cache table is in the public schema but has RLS disabled,
--    which exposes it via PostgREST. It is only meant to be read/written by
--    the service role, so we enable RLS with no policies — service role
--    bypasses RLS, so the cron + API route keep working, while anonymous and
--    authenticated clients are blocked.

-- ── 1. Switch views to security_invoker ──────────────────────────────────────

alter view if exists public.project_search_documents      set (security_invoker = true);
alter view if exists public.professional_search_documents set (security_invoker = true);
alter view if exists public.company_metrics               set (security_invoker = true);

-- ── 2. Enable RLS on posthog_cache (no policies = service-role only) ─────────

alter table if exists public.posthog_cache enable row level security;
