-- ─────────────────────────────────────────────────────────────────────────────
-- 120_drip_queue_prospect_columns.sql
--
-- Extends email_drip_queue to support the prospect drip sequence (PR 1 of 5
-- in the drip-pipeline buildout). See the "Performance / email drip" plan
-- on Notion for the full story; quick recap of what and why:
--
--  * `company_id` — without this we can't cancel a whole sequence when a
--    company is claimed / its status changes / a bounce webhook fires, and
--    we'd have to bake stale company data into `variables` at enqueue time.
--    ON DELETE CASCADE so deleting a company cleans up its pending rows.
--
--  * `last_error` + `attempt_count` — the current cron swallows failures
--    silently. With these, a Resend rejection gets written back and the
--    admin dashboard can surface it + stop retrying after N attempts.
--
--  * `cancelled_reason` — paired with `cancelled_at`, makes admin debugging
--    trivial ("why did this stop sending?"). Cheap to add now; expensive
--    migration later.
--
--  * Partial unique index on (company_id, template) WHERE both company_id
--    is not null AND the row is still pending. Prevents the double-enqueue
--    bug where clicking "Send prospect email" twice on the same company
--    would schedule two followups. Intentionally does NOT cover the
--    homeowner series rows (company_id is null there).
--
-- No behaviour change: all new columns are nullable / default zero, and
-- the existing cron function ignores them. PR 2 wires them up.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.email_drip_queue
  add column if not exists company_id uuid
    references public.companies(id) on delete cascade,
  add column if not exists last_error text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists cancelled_reason text;

-- Index for the cancel-pending-for-company hot path (PR 4).
create index if not exists idx_drip_queue_company_pending
  on public.email_drip_queue (company_id)
  where sent_at is null and cancelled_at is null and company_id is not null;

-- Prevent double-enqueue on the same (company, template) while the row is
-- still pending. Scoped with a partial predicate so it only affects the
-- prospect series (where company_id is not null). Sent or cancelled rows
-- no longer occupy the slot, which is the desired behaviour: if a final
-- has sent, a later click that schedules a new followup is fine.
create unique index if not exists idx_drip_queue_company_template_unique
  on public.email_drip_queue (company_id, template)
  where sent_at is null and cancelled_at is null and company_id is not null;

-- Best-effort backfill: for any pending row whose email matches a prospect
-- record, link them. In practice today this is a no-op because the six
-- pending rows are all homeowner-welcome-series sends with no matching
-- prospects — but putting the statement in means if the migration is
-- re-run after some prospect rows have been enqueued, it stays idempotent.
update public.email_drip_queue q
   set company_id = p.company_id
  from public.prospects p
 where q.company_id is null
   and q.email is not null
   and p.email = q.email
   and p.company_id is not null
   and q.sent_at is null
   and q.cancelled_at is null;

comment on column public.email_drip_queue.company_id        is 'FK to companies. Set for prospect-series rows so we can cancel a whole sequence by company. Null for non-company flows like welcome-homeowner.';
comment on column public.email_drip_queue.last_error        is 'Last error message from the sender (e.g. Resend rejection). Cleared on success.';
comment on column public.email_drip_queue.attempt_count     is 'Number of send attempts. Cron stops retrying once this hits MAX_ATTEMPTS (3).';
comment on column public.email_drip_queue.cancelled_reason  is 'Why the row was cancelled: claimed / bounced / complained / status_change / manual / admin.';
