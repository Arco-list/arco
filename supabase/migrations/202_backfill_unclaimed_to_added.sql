-- 202: Backfill company_status 'unclaimed' -> 'added'
--
-- 'unclaimed' predates the Added status and was carried by 68
-- Apollo-imported outreach-pool companies (source='apollo', no owner,
-- >=1 prospect, 0 project links). The admin UI stopped offering
-- 'unclaimed' when Added was introduced; these rows were simply never
-- migrated. Visibility is unaffected: /admin/companies filters on
-- source IN (direct,manual,invited) OR claimed statuses, so
-- apollo-sourced Added rows stay confined to /admin/sales.
--
-- The enum value 'unclaimed' itself stays (Postgres cannot drop enum
-- values), but nothing writes it anymore.

UPDATE public.companies
SET status = 'added'
WHERE status = 'unclaimed';
