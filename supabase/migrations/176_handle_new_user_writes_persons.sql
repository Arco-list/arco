-- Extend handle_new_user to keep `persons` in sync with auth.users.
--
-- On every signup we now do two things:
--   1. Insert the legacy profiles row (existing behaviour).
--   2. Either link the auth user to an existing persons row (Apollo
--      prospect, team invite, manual add) OR create a new persons row
--      with source='direct'. Linking matches by case-insensitive email.
--
-- The existing source value on a matched persons row is preserved — a
-- direct signup of someone we'd previously Apollo'd stays source='apollo'
-- because that's how the person entered the system. Lifecycle status is
-- handled separately (via outreach state on persons + per-deal status on
-- company_contacts).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_meta jsonb := NEW.raw_user_meta_data;
  v_full_name text := COALESCE(v_meta->>'full_name', v_meta->>'name');
  v_first_name text := COALESCE(
    v_meta->>'first_name',
    NULLIF(split_part(v_full_name, ' ', 1), '')
  );
  v_last_name text := COALESCE(
    v_meta->>'last_name',
    CASE
      WHEN v_full_name IS NULL OR position(' ' IN v_full_name) = 0 THEN NULL
      ELSE substr(v_full_name, position(' ' IN v_full_name) + 1)
    END
  );
  v_email_lc text := lower(NEW.email);
  v_existing_person_id uuid;
BEGIN
  -- 1. Legacy profiles row.
  INSERT INTO public.profiles (id, first_name, last_name, avatar_url, user_types, preferred_language)
  VALUES (
    NEW.id,
    v_first_name,
    v_last_name,
    COALESCE(v_meta->>'avatar_url', v_meta->>'picture'),
    ARRAY[COALESCE(v_meta->>'user_type', 'client')]::text[],
    v_meta->>'preferred_language'
  );

  -- 2. Persons row. Try to link an existing person by email; if none,
  -- create a fresh one as source='direct'.
  IF v_email_lc IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing_person_id
  FROM public.persons
  WHERE lower(email) = v_email_lc
  LIMIT 1;

  IF v_existing_person_id IS NOT NULL THEN
    -- Link the auth user; fill name fields only when blank (don't clobber
    -- whatever already exists on the person, e.g. from Apollo).
    UPDATE public.persons
    SET
      auth_user_id = NEW.id,
      first_name = COALESCE(first_name, v_first_name),
      last_name = COALESCE(last_name, v_last_name)
    WHERE id = v_existing_person_id
      AND auth_user_id IS NULL;
  ELSE
    INSERT INTO public.persons (email, first_name, last_name, source, auth_user_id)
    VALUES (NEW.email, v_first_name, v_last_name, 'direct'::public.person_source, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;
