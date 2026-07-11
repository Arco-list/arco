-- companies.setup_reset_at — timestamp that an admin last rolled the
-- company back to Created (draft). The company edit tour includes this
-- in its localStorage seen-flag key, so a bump invalidates the flag and
-- the tour runs again from scratch. NULL until the first admin
-- rollback.
ALTER TABLE public.companies
  ADD COLUMN setup_reset_at timestamptz;

COMMENT ON COLUMN public.companies.setup_reset_at IS
  'Set to now() whenever an admin flips this company back to draft (Created). The company-edit tour keys its "seen" flag on this timestamp so an admin-triggered rollback re-runs the tour even if the owner already dismissed it.';
