-- ═══════════════════════════════════════════════════════════════════════
-- 244: prospect_status 'unlisted' — the company→prospect mirror value
-- ═══════════════════════════════════════════════════════════════════════
-- From Verified on, the prospect ladder mirrors companies.status. A
-- listed company whose page goes dark becomes 'unlisted' — without
-- this value the mirror write fails and Sales keeps reading "Listed"
-- for companies that are no longer live (Studio Martijn Veldman case).
-- Sits between 'owned' and 'active' in ladder rank (the JS ladders in
-- lib/prospect-ref.ts, sales/actions.ts and the drip cron agree).

ALTER TYPE prospect_status ADD VALUE IF NOT EXISTS 'unlisted';
