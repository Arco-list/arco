-- Add auto_approve_projects flag to companies table
-- When enabled, projects submitted by this company skip admin review and are published immediately

ALTER TABLE public.companies
  ADD COLUMN auto_approve_projects boolean NOT NULL DEFAULT false;
