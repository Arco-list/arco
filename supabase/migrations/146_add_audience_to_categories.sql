-- Audience flag on service categories.
--   'homeowner' → companies offering this service surface in /professionals
--                 (homeowner-facing discovery)
--   'pro'       → companies are visible to logged-in publishing pros only
--                 (e.g. photographers — found via project credit, claimed
--                 from /businesses/professionals, but never listed for
--                 homeowner browsing)
--
-- Defaults to 'homeowner' so existing categories keep current behaviour.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'homeowner'
  CHECK (audience IN ('homeowner', 'pro'));

COMMENT ON COLUMN public.categories.audience IS
  'Who can discover companies in this category. ''homeowner'' = public /professionals listing; ''pro'' = visible only to logged-in publishing professionals (e.g. Photographer).';

UPDATE public.categories
SET audience = 'pro'
WHERE slug = 'photographer';
