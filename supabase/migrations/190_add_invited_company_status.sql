-- Add 'invited' to company_status enum. The admin/companies funnel and
-- STATUS_LABEL already reference this value, but nothing assigned it —
-- because it wasn't in the enum, the "Invited" bucket was always 0.
-- Enum position: after 'added', consistent with the funnel order
-- Added → Showcased → Invited → Created → Listed.
ALTER TYPE company_status ADD VALUE IF NOT EXISTS 'invited' AFTER 'added';
