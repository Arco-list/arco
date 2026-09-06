-- Unsubscribes join the per-template stats cache. Counted from
-- email_events rows with event_type='unsubscribed' (provider='arco' —
-- our own unsubscribe endpoint logs them, Resend does not), attributed
-- to a template via metadata.resend_message_id.
alter table public.email_stats_cache
  add column if not exists unsubscribed integer not null default 0;
