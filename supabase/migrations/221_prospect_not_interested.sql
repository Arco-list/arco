-- "Not interested" — a sequence end-state alongside bounced/unsubscribed:
-- the outreach sequence is over, no follow-ups, retouch with care. Unlike
-- unsubscribed it is a polite decline, not a consent/deliverability state,
-- so it renders amber rather than red and can be deliberately undone.
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS not_interested_at timestamptz;
