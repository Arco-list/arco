-- Add 'draft' status for companies that haven't completed setup
ALTER TYPE company_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'unlisted';

-- Change default for new companies to 'draft'
ALTER TABLE companies ALTER COLUMN status SET DEFAULT 'draft'::company_status;
