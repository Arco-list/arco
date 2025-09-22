-- Migration: Create profiles table with auth.users integration
-- Description: Extended user profile data that references Supabase auth.users

-- Create profiles table that extends auth.users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type user_type NOT NULL DEFAULT 'client',
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  location TEXT,
  website TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT profiles_first_name_length CHECK (first_name IS NULL OR length(first_name) >= 1),
  CONSTRAINT profiles_last_name_length CHECK (last_name IS NULL OR length(last_name) >= 1),
  CONSTRAINT profiles_phone_format CHECK (phone IS NULL OR length(phone) >= 10),
  CONSTRAINT profiles_bio_length CHECK (bio IS NULL OR length(bio) <= 2000)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create trigger to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, user_type)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE((NEW.raw_user_meta_data ->> 'user_type')::user_type, 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add indexes
CREATE INDEX idx_profiles_user_type ON public.profiles(user_type);
CREATE INDEX idx_profiles_location ON public.profiles(location) WHERE location IS NOT NULL;
CREATE INDEX idx_profiles_verified ON public.profiles(is_verified) WHERE is_verified = TRUE;
CREATE INDEX idx_profiles_active ON public.profiles(is_active) WHERE is_active = TRUE;

-- Add comments
COMMENT ON TABLE public.profiles IS 'Extended user profile data';
COMMENT ON COLUMN public.profiles.id IS 'References auth.users.id';
COMMENT ON COLUMN public.profiles.user_type IS 'Type of user: client, professional, or admin';
COMMENT ON COLUMN public.profiles.is_verified IS 'Whether the user profile has been verified';
COMMENT ON COLUMN public.profiles.is_active IS 'Whether the user account is active';