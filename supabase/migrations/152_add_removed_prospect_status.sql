-- Add 'removed' to prospect_status enum.
--
-- The /admin/sales rewrite (one-row-per-company) introduces a "Remove"
-- per-contact action: kicks the prospect row out of the funnel without
-- deleting the underlying record (so we keep history + can re-add later
-- if Apollo or invites resurfaces the same email).
ALTER TYPE public.prospect_status ADD VALUE IF NOT EXISTS 'removed';
