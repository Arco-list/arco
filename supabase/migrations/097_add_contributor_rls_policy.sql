-- Migration 097: Add RLS policy for contributors to update their company's project status
-- This allows team members to control how their company appears on projects

-- Create policy allowing contributors to update their company's status on projects
CREATE POLICY project_professionals_contributor_update
ON public.project_professionals
FOR UPDATE
USING (
  -- User is a team member of the company on this project
  company_id IN (
    SELECT company_id
    FROM public.professionals
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  -- Same check - ensure they can only update their own company's records
  company_id IN (
    SELECT company_id
    FROM public.professionals
    WHERE user_id = auth.uid()
  )
);

COMMENT ON POLICY project_professionals_contributor_update ON public.project_professionals IS
'Allows company team members to update their company''s visibility status on projects (invited, unlisted, listed, live_on_page, rejected)';
