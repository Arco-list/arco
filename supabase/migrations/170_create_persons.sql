-- Create persons — canonical human record across the prospect/user lifecycle.
--
-- Replaces the role today played by `prospects` (sales contact records) and
-- the implicit "any person we know about" concept that's currently scattered
-- across prospects + profiles. A person is identified by email and persists
-- across signup: when they sign up, `auth_user_id` is populated and a
-- `profiles` row is created, but the same `persons` row carries lifecycle +
-- outreach history forward.
--
-- This migration creates the table and backfills it from existing data.
-- It does NOT yet retire `prospects` or move foreign keys — code keeps using
-- the old tables. The cutover happens in later migrations.

CREATE TYPE public.person_source AS ENUM ('apollo', 'direct', 'manual', 'invited');

CREATE TABLE public.persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  email text NOT NULL,
  first_name text,
  last_name text,
  phone text,
  phone_country_code text,

  source public.person_source NOT NULL DEFAULT 'manual',

  -- Populated on signup. NULL = prospect / not (yet) a platform user.
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Email engagement metrics (counters + last-event timestamps). Per-person
  -- because emails are addressed to an email, not to a (person, company) pair.
  emails_sent integer NOT NULL DEFAULT 0,
  emails_delivered integer NOT NULL DEFAULT 0,
  emails_opened integer NOT NULL DEFAULT 0,
  emails_clicked integer NOT NULL DEFAULT 0,
  last_email_sent_at timestamptz,
  last_email_opened_at timestamptz,
  last_email_clicked_at timestamptz,

  -- Compliance / engagement state. Also per-person — if a person unsubscribes
  -- they're unsubscribed for every company we'd email them at.
  unsubscribed_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  replied_at timestamptz,

  -- Lifecycle hints kept as text (mirrors prospect_status enum values, but
  -- not enum-typed here so the values can evolve without ALTER TYPE).
  sequence_status text,
  email_status text,

  notes text,
  preferred_language text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive unique index on email. Storing the raw value (preserving
-- case for display) while ensuring "Foo@x.com" and "foo@x.com" are treated
-- as the same person.
CREATE UNIQUE INDEX persons_email_lower_key ON public.persons (lower(email));
CREATE INDEX persons_source_idx ON public.persons (source);
CREATE INDEX persons_auth_user_id_idx ON public.persons (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE TRIGGER persons_set_updated_at
  BEFORE UPDATE ON public.persons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY persons_admin_all ON public.persons
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND 'admin' = ANY (profiles.user_types)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND 'admin' = ANY (profiles.user_types)
    )
  );

CREATE POLICY persons_service_role_all ON public.persons
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Backfill ----------------------------------------------------------------
-- Order matters: prospects first (they own the outreach metrics), then
-- profiles fill in auth_user_id for ones who later signed up.

-- One row per distinct email from prospects. If a person has multiple
-- prospect rows for the same email (different sources / re-imports), prefer
-- the one with the most engagement (has user_id → has email metrics → most
-- recent created_at). Done via DISTINCT ON for clarity.
-- Note: auth_user_id is deliberately NOT populated from prospects.user_id
-- here. A prospect's email and their auth.users email don't always match
-- (signup-with-different-email is common), and treating two different
-- emails as the same person via the prospect→auth link would collapse
-- distinct email identities. Step 2 below sets auth_user_id only when the
-- profile's auth.email matches a person's email — the safe case. Mismatched
-- emails stay as two separate persons; admins can merge later.
INSERT INTO public.persons (
  email, first_name, last_name, phone, source,
  emails_sent, emails_delivered, emails_opened, emails_clicked,
  last_email_sent_at, last_email_opened_at, last_email_clicked_at,
  unsubscribed_at, bounced_at, complained_at, replied_at,
  sequence_status, email_status, notes, created_at, updated_at
)
SELECT DISTINCT ON (lower(email))
  email,
  NULLIF(split_part(contact_name, ' ', 1), '') AS first_name,
  NULLIF(
    CASE WHEN position(' ' IN contact_name) > 0
         THEN substring(contact_name FROM position(' ' IN contact_name) + 1)
         ELSE NULL
    END, '') AS last_name,
  phone,
  CASE source
    WHEN 'apollo'  THEN 'apollo'::public.person_source
    WHEN 'arco'    THEN 'direct'::public.person_source
    WHEN 'invites' THEN 'invited'::public.person_source
    ELSE 'manual'::public.person_source
  END AS source,
  COALESCE(emails_sent, 0),
  COALESCE(emails_delivered, 0),
  COALESCE(emails_opened, 0),
  COALESCE(emails_clicked, 0),
  last_email_sent_at, last_email_opened_at, last_email_clicked_at,
  unsubscribed_at, bounced_at, complained_at, replied_at,
  sequence_status::text, email_status, notes, created_at, updated_at
FROM public.prospects
WHERE email IS NOT NULL
ORDER BY
  lower(email),
  COALESCE(emails_sent, 0) DESC,
  created_at ASC;

-- Fill in profiles. For emails that already came in from prospects, just
-- attach auth_user_id (and first/last name if missing). For profiles whose
-- email isn't in prospects, insert fresh as source='direct'.
INSERT INTO public.persons (
  email, first_name, last_name, source, auth_user_id, created_at, updated_at
)
SELECT
  au.email,
  p.first_name,
  p.last_name,
  'direct'::public.person_source,
  p.id,
  p.created_at,
  p.updated_at
FROM public.profiles p
JOIN auth.users au ON au.id = p.id
WHERE au.email IS NOT NULL
ON CONFLICT (lower(email)) DO UPDATE SET
  auth_user_id = COALESCE(persons.auth_user_id, EXCLUDED.auth_user_id),
  first_name   = COALESCE(persons.first_name,   EXCLUDED.first_name),
  last_name    = COALESCE(persons.last_name,    EXCLUDED.last_name);
