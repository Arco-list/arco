-- Two channels the first-touch vocabulary was missing.
--
-- AI, because it is already here and we could not see it. In September
-- chatgpt.com was the second-largest external referrer after Google and
-- made up the entire Referral channel by itself, while gemini.google.com
-- was being counted as organic search — the domain matches "google."
-- and the search rule fired first. An assistant that answers a question
-- and hands over a link is a different motion from a magazine linking
-- to us, and it is the one that is growing.
--
-- PAID, because the tagging has to exist before the spend. An ad click
-- carries no referrer worth trusting, so paid is only ever as reliable
-- as the utm that was put on it. Adding the slot now means the first
-- campaign lands in its own row instead of being discovered later in
-- Direct.
--
-- The CHECK constraint is the reason this is a migration rather than a
-- code change: lib/source-attribution.ts can classify a visitor as 'ai'
-- all it likes, but the write is refused until the column agrees.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_profiles_first_touch_source;
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_first_touch_source
  CHECK (
    first_touch_source IS NULL
    OR first_touch_source = ANY (ARRAY[
      'sales', 'invites', 'email', 'shares',
      'google', 'social', 'referral', 'ai', 'paid', 'direct'
    ]::text[])
  );

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS chk_companies_first_touch_source;
ALTER TABLE public.companies
  ADD CONSTRAINT chk_companies_first_touch_source
  CHECK (
    first_touch_source IS NULL
    OR first_touch_source = ANY (ARRAY[
      'sales', 'invites', 'email', 'shares',
      'google', 'social', 'referral', 'ai', 'paid', 'direct'
    ]::text[])
  );

COMMENT ON COLUMN public.profiles.first_touch_source IS
  'Channel of the visitor''s first touch, from lib/source-attribution.ts. Ten values; ''ai'' covers assistants that hand over a link (ChatGPT, Perplexity, Claude, Gemini, Copilot) and is matched before the search-engine list so gemini.google.com does not read as organic search.';
