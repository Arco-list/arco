-- Rename the `added` company_status enum value to `unclaimed`.
--
-- "Added" described the origin of the row (admin clicked "Add company")
-- rather than its actual state. Since migration 126's orphan-and-claimable
-- delete flow also produces ownerless companies, the same bucket holds
-- two different origins. The meaningful shared state is "no owner,
-- waiting to be claimed" — so we move to the `unclaimed` label.
--
-- ┌─ Why this migration is simple, not a full enum swap ──────────────────┐
-- │                                                                       │
-- │ The "clean" rename (drop old enum, create new one without `added`)   │
-- │ requires rebuilding everything that depends on companies.status:      │
-- │                                                                       │
-- │   • mv_project_summary        (MV)                                   │
-- │   • mv_company_listings       (MV)                                   │
-- │   • mv_professional_summary   (MV)                                   │
-- │   • professional_search_documents (view — cascades from above)       │
-- │   • search_projects           (RPC — references mv_project_summary)  │
-- │   • company_photos_public_select (RLS policy on company_photos)      │
-- │                                                                       │
-- │ That's ~400 lines of verbatim SQL copied from live pg_get_viewdef    │
-- │ output, and any drift between what lives in the DB today vs what's   │
-- │ in the recreated CREATE statements silently changes behavior. Not    │
-- │ worth the risk for a cosmetic schema cleanup.                        │
-- │                                                                       │
-- │ Instead: ADD VALUE `unclaimed` to the enum, backfill `added` rows    │
-- │ to the new label, leave `added` in the type definition as a dead    │
-- │ orphan value. Runtime code never references it after this commit.    │
-- │                                                                       │
-- └───────────────────────────────────────────────────────────────────────┘
--
-- ALTER TYPE ... ADD VALUE cannot run in the same transaction as a query
-- that uses the new value. Run this file in TWO SEPARATE SQL editor
-- executions:
--
--   1. Paste + run the ADD VALUE statement on its own (first block below)
--   2. Paste + run the UPDATE statement on its own (second block below)
--
-- Each block is idempotent (ADD VALUE uses IF NOT EXISTS; UPDATE is a
-- safe no-op if the migration was already applied).

-- ═══ Block 1 — run first, on its own ════════════════════════════════════
alter type public.company_status add value if not exists 'unclaimed';

-- ═══ Block 2 — run second, after block 1 has committed ══════════════════
update public.companies
  set status = 'unclaimed'::company_status
  where status::text = 'added';
