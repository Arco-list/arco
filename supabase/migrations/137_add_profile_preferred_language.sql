-- ═══════════════════════════════════════════════════════════════════════
-- 137: profiles.preferred_language for client email targeting
-- ═══════════════════════════════════════════════════════════════════════
-- Captures the user's locale preference so transactional emails (welcome,
-- password reset, project notifications, drips) can target the right
-- language without re-deriving it per send.
--
-- Captured at signup from the URL locale (which middleware.ts now
-- pre-resolves from the Accept-Language header for first visits, see
-- migration commit "Locale detection: non-Dutch browsers default to /en").
-- Editable later via the account page language switcher.
--
-- Stored as text rather than an enum so adding 'fr', 'de', etc. doesn't
-- need a follow-up migration. Application-side validation lives in
-- i18n/config.ts (the `locales` const).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text;

COMMENT ON COLUMN public.profiles.preferred_language IS
  'BCP 47 short tag (e.g. ''nl'', ''en''). Source of truth for the user''s preferred language for emails. Set at signup from the URL locale; users can change it later in account settings.';

-- Update the auto-create trigger so signup metadata
-- ({ preferred_language: 'nl' | 'en' }) lands on the profile row in the
-- same insert as first_name/last_name.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, user_type, preferred_language)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE((NEW.raw_user_meta_data ->> 'user_type')::user_type, 'client'),
    NEW.raw_user_meta_data ->> 'preferred_language'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
