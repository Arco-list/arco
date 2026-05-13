-- 164_first_touch_source.sql
--
-- Stamps the first-touch acquisition source on the user (profiles)
-- and the company (companies). Categorized into a stable taxonomy
-- shared with the Growth Model's channel breakdowns:
--
--   sales     — first touch on a Sales landing (Outreach/Showcase)
--   invites   — first touch via a project invite landing
--   email     — first touch from a webmail referrer or Arco email UTM
--   shares    — first touch via a tagged share URL (utm_source=share)
--   google    — first touch from a search engine
--   social    — first touch from a social network
--   referral  — first touch from another website (catch-all external)
--   direct    — first touch with no referrer (typed URL / bookmark)
--
-- Why on the row, not at read time:
--   The PostHog channel breakdowns count `user_signed_up` event
--   person_ids, while the parent counts come from Supabase
--   (companies.onboarded_at, profiles.created_at). The two units
--   disagree (team-member invites fire signup events without a new
--   company; a single signup can produce multiple PostHog persons via
--   identity-merge race conditions). Stamping the source on the row
--   makes channels and parent count the same things, so they sum.
--
-- Inheritance:
--   companies.first_touch_source inherits from the owner's profile at
--   onboard time. Set in app code rather than a DB trigger because
--   PL/pgSQL can't easily read another table in a BEFORE-UPDATE hook.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_touch_source TEXT;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS first_touch_source TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_first_touch_source
  ON public.profiles (first_touch_source)
  WHERE first_touch_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_companies_first_touch_source
  ON public.companies (first_touch_source)
  WHERE first_touch_source IS NOT NULL;

-- Sanity check on the value set the application is allowed to write.
-- Keep loose (CHECK constraint) so we can add new categories without
-- migrating data — invalid values raise a write-time error rather
-- than corrupt the analytics surface.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_profiles_first_touch_source;
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_first_touch_source
  CHECK (first_touch_source IS NULL OR first_touch_source IN (
    'sales', 'invites', 'email', 'shares',
    'google', 'social', 'referral', 'direct'
  ));

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS chk_companies_first_touch_source;
ALTER TABLE public.companies
  ADD CONSTRAINT chk_companies_first_touch_source
  CHECK (first_touch_source IS NULL OR first_touch_source IN (
    'sales', 'invites', 'email', 'shares',
    'google', 'social', 'referral', 'direct'
  ));
