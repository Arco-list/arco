-- Make owner_id nullable so companies created via project invites can exist without an owner
-- These "claimable" companies can later be claimed by domain verification
ALTER TABLE public.companies ALTER COLUMN owner_id DROP NOT NULL;

-- Update RLS: allow users to claim unowned companies (update where owner_id IS NULL)
CREATE POLICY companies_claim_unowned ON public.companies
  FOR UPDATE
  USING (owner_id IS NULL)
  WITH CHECK (auth.uid() = owner_id);

-- Clear owner_id on unlisted companies that were created via project invites
-- (incorrectly assigned to the project creator instead of being ownerless)
UPDATE public.companies
SET owner_id = NULL
WHERE status = 'unlisted'
  AND owner_id = '2c28d7ec-d180-4d13-854a-8100116b2abb';
