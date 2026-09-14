-- ═══════════════════════════════════════════════════════════════════════
-- 243: company_source 'admin' — lean claimable shells
-- ═══════════════════════════════════════════════════════════════════════
-- The new admin "Add company" button creates companies that exist only
-- to be claimable in the signup flow: status 'added', no contact, no
-- page-build intent. They need their own source so the companies table
-- can park them out of the default view without touching the showcase
-- rows (source 'manual', the current button) that must stay visible.

ALTER TYPE company_source ADD VALUE IF NOT EXISTS 'admin';
