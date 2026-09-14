-- ═══════════════════════════════════════════════════════════════════════
-- 242: Per-teamlid toggle for company transactional mail
-- ═══════════════════════════════════════════════════════════════════════
-- Company events (introduction request, project live/rejected) used to
-- go to the owner's address only — nobody else on the team saw them.
-- Each team contact now carries receives_company_email; the team page
-- exposes it as a toggle, admins/owners default on, and the send sites
-- fan out to every contact with the flag set (owner as fallback when
-- none is on). Server actions enforce "at least one receiver".

ALTER TABLE public.company_contacts
  ADD COLUMN IF NOT EXISTS receives_company_email boolean NOT NULL DEFAULT false;

UPDATE public.company_contacts
SET receives_company_email = true
WHERE role IN ('owner', 'admin');
