-- 205: server-side "tour seen" flags.
--
-- The onboarding tours (company edit, project edit) tracked their
-- "already seen" state in localStorage only, so every new browser,
-- device or incognito session replayed the ceremony for the same
-- person. One row per (user, tour_key) makes the flag follow the
-- account instead of the browser. tour_key embeds the target id and
-- any reset fragment (e.g. companies.setup_reset_at), so an admin
-- rollback still re-triggers the tour by changing the key.

CREATE TABLE IF NOT EXISTS public.ui_tour_seen (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tour_key text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tour_key)
);

ALTER TABLE public.ui_tour_seen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ui_tour_seen_select_own"
  ON public.ui_tour_seen FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "ui_tour_seen_insert_own"
  ON public.ui_tour_seen FOR INSERT
  WITH CHECK (auth.uid() = user_id);
