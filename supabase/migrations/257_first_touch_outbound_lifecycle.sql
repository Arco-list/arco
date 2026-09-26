-- Two more first-touch values, both of them about mail we send.
--
-- OUTBOUND is mail an admin writes by hand in the contact card and
-- sends through the product. That send is the boundary: from a personal
-- mailbox the link carries no tag at all, and the click is
-- indistinguishable from someone typing the address.
--
-- LIFECYCLE is mail to people who already are what the funnel is trying
-- to make them — pro transactional, the Owned and Listed drips,
-- subscription notices, auth. It is tagged so PostHog shows it was our
-- mail, and deliberately NOT counted as an acquisition channel: 24 of
-- 41 templates go to existing supply, and counting them put pro
-- retention inside a client acquisition row.
--
-- Same reason as 255: lib/source-attribution.ts can classify a visitor
-- as 'outbound' all it likes, but the write is refused until the column
-- agrees.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_profiles_first_touch_source;
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_first_touch_source
  CHECK (
    first_touch_source IS NULL
    OR first_touch_source = ANY (ARRAY[
      'sales', 'invites', 'outbound', 'email', 'shares',
      'google', 'social', 'referral', 'ai', 'paid', 'lifecycle', 'direct'
    ]::text[])
  );

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS chk_companies_first_touch_source;
ALTER TABLE public.companies
  ADD CONSTRAINT chk_companies_first_touch_source
  CHECK (
    first_touch_source IS NULL
    OR first_touch_source = ANY (ARRAY[
      'sales', 'invites', 'outbound', 'email', 'shares',
      'google', 'social', 'referral', 'ai', 'paid', 'lifecycle', 'direct'
    ]::text[])
  );

COMMENT ON COLUMN public.profiles.first_touch_source IS
  'Channel of the visitor''s first touch, from lib/source-attribution.ts. Twelve values. ''outbound'' is mail an admin wrote by hand through the product; ''lifecycle'' is mail to people who already are what the funnel is trying to make them, and is deliberately not an acquisition channel.';
