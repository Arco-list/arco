-- Migration: Allow admin management of professional invites
-- Description: Adds policy to let admin users update project_professionals rows without service role key.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_professionals'
      AND policyname = 'project_professionals_admin_update'
  ) THEN
    EXECUTE '
      CREATE POLICY project_professionals_admin_update ON public.project_professionals
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles AS p
          WHERE p.id = auth.uid()
            AND COALESCE(p.user_types, ''{}''::text[]) @> ARRAY[''admin'']::text[]
        )
      )
      WITH CHECK (TRUE)
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companies'
      AND policyname = 'companies_admin_update'
  ) THEN
    EXECUTE '
      CREATE POLICY companies_admin_update ON public.companies
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles AS p
          WHERE p.id = auth.uid()
            AND COALESCE(p.user_types, ''{}''::text[]) @> ARRAY[''admin'']::text[]
        )
      )
      WITH CHECK (TRUE)
    ';
  END IF;
END;
$$;
