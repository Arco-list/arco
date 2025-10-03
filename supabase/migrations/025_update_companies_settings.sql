-- Migration: Update companies schema for settings PRD
-- Description: Adds status, plan, domain, social link, and photo support for company settings

BEGIN;

-- Create enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_status') THEN
    CREATE TYPE public.company_status AS ENUM ('unlisted', 'listed', 'deactivated');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_plan_tier') THEN
    CREATE TYPE public.company_plan_tier AS ENUM ('basic', 'plus');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'custom_domain_status') THEN
    CREATE TYPE public.custom_domain_status AS ENUM ('none', 'pending_verification', 'verified', 'failed');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_social_platform') THEN
    CREATE TYPE public.company_social_platform AS ENUM ('facebook', 'instagram', 'linkedin', 'pinterest');
  END IF;
END
$$;

-- Extend companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS status public.company_status NOT NULL DEFAULT 'unlisted',
  ADD COLUMN IF NOT EXISTS plan_tier public.company_plan_tier NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS upgrade_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_status public.custom_domain_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS custom_domain_last_checked TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS primary_service_id UUID REFERENCES public.categories(id),
  ADD COLUMN IF NOT EXISTS services_offered TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS certificates TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Ensure arrays default to empty when null is inserted
ALTER TABLE public.companies
  ALTER COLUMN services_offered SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN languages SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN certificates SET DEFAULT ARRAY[]::TEXT[];

-- Social links table
CREATE TABLE IF NOT EXISTS public.company_social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  platform public.company_social_platform NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_social_links_url_check CHECK (url ~* '^https?://')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_social_links_company_platform
  ON public.company_social_links(company_id, platform);

-- Company photos table
CREATE TABLE IF NOT EXISTS public.company_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT,
  alt_text TEXT,
  caption TEXT,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0),
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_photos_url_check CHECK (char_length(url) > 0),
  CONSTRAINT company_photos_caption_length CHECK (caption IS NULL OR char_length(caption) <= 300),
  CONSTRAINT company_photos_file_size CHECK (file_size IS NULL OR file_size > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_photos_cover
  ON public.company_photos(company_id)
  WHERE is_cover;

-- Enable RLS
ALTER TABLE public.company_social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_photos ENABLE ROW LEVEL SECURITY;

-- Policies for social links
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_social_links'
      AND policyname = 'company_social_links_owner_select'
  ) THEN
    CREATE POLICY company_social_links_owner_select
      ON public.company_social_links
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.companies c
          WHERE c.id = company_id AND c.owner_id = auth.uid()
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_social_links'
      AND policyname = 'company_social_links_owner_insert'
  ) THEN
    CREATE POLICY company_social_links_owner_insert
      ON public.company_social_links
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.companies c
          WHERE c.id = company_id AND c.owner_id = auth.uid()
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_social_links'
      AND policyname = 'company_social_links_owner_update'
  ) THEN
    CREATE POLICY company_social_links_owner_update
      ON public.company_social_links
      FOR UPDATE USING (
        EXISTS (
          SELECT 1
          FROM public.companies c
          WHERE c.id = company_id AND c.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.companies c
          WHERE c.id = company_id AND c.owner_id = auth.uid()
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_social_links'
      AND policyname = 'company_social_links_owner_delete'
  ) THEN
    CREATE POLICY company_social_links_owner_delete
      ON public.company_social_links
      FOR DELETE USING (
        EXISTS (
          SELECT 1
          FROM public.companies c
          WHERE c.id = company_id AND c.owner_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- Policies for company photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_photos'
      AND policyname = 'company_photos_owner_select'
  ) THEN
    CREATE POLICY company_photos_owner_select
      ON public.company_photos
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.companies c
          WHERE c.id = company_id AND c.owner_id = auth.uid()
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_photos'
      AND policyname = 'company_photos_owner_insert'
  ) THEN
    CREATE POLICY company_photos_owner_insert
      ON public.company_photos
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.companies c
          WHERE c.id = company_id AND c.owner_id = auth.uid()
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_photos'
      AND policyname = 'company_photos_owner_update'
  ) THEN
    CREATE POLICY company_photos_owner_update
      ON public.company_photos
      FOR UPDATE USING (
        EXISTS (
          SELECT 1
          FROM public.companies c
          WHERE c.id = company_id AND c.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.companies c
          WHERE c.id = company_id AND c.owner_id = auth.uid()
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_photos'
      AND policyname = 'company_photos_owner_delete'
  ) THEN
    CREATE POLICY company_photos_owner_delete
      ON public.company_photos
      FOR DELETE USING (
        EXISTS (
          SELECT 1
          FROM public.companies c
          WHERE c.id = company_id AND c.owner_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- Updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'handle_company_social_links_updated_at'
  ) THEN
    CREATE TRIGGER handle_company_social_links_updated_at
      BEFORE UPDATE ON public.company_social_links
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'handle_company_photos_updated_at'
  ) THEN
    CREATE TRIGGER handle_company_photos_updated_at
      BEFORE UPDATE ON public.company_photos
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END
$$;

-- Storage bucket and policies for company assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'company_assets_public_read'
  ) THEN
    CREATE POLICY company_assets_public_read
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'company-assets');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'company_assets_owner_insert'
  ) THEN
    CREATE POLICY company_assets_owner_insert
      ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = 'company-assets'
        AND EXISTS (
          SELECT 1
          FROM public.companies c
          WHERE c.owner_id = auth.uid()
            AND c.id::text = split_part(name, '/', 1)
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'company_assets_owner_update'
  ) THEN
    CREATE POLICY company_assets_owner_update
      ON storage.objects
      FOR UPDATE
      USING (
        bucket_id = 'company-assets'
        AND EXISTS (
          SELECT 1
          FROM public.companies c
          WHERE c.owner_id = auth.uid()
            AND c.id::text = split_part(name, '/', 1)
        )
      )
      WITH CHECK (
        bucket_id = 'company-assets'
        AND EXISTS (
          SELECT 1
          FROM public.companies c
          WHERE c.owner_id = auth.uid()
            AND c.id::text = split_part(name, '/', 1)
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'company_assets_owner_delete'
  ) THEN
    CREATE POLICY company_assets_owner_delete
      ON storage.objects
      FOR DELETE
      USING (
        bucket_id = 'company-assets'
        AND EXISTS (
          SELECT 1
          FROM public.companies c
          WHERE c.owner_id = auth.uid()
            AND c.id::text = split_part(name, '/', 1)
        )
      );
  END IF;
END
$$;

COMMIT;
