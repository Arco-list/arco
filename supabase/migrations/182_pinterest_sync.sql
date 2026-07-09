-- Pinterest sync — auto-publishes pins for every published project,
-- fanning out one pin per space feature to the matching space board
-- (Kitchen, Bathroom, Living, …) plus one pin on the type board
-- (Villas, Townhouses, …) using the project cover.
--
-- Design:
--   * Two axes: type boards + space boards. Exterior space excluded.
--   * Projects without space features still publish to a type board.
--   * All fan-out is decoupled through pinterest_queue — user-facing
--     project-publish actions never block on Pinterest's API.
--   * Sync state persists on both projects (type pin) and
--     project_features (per-space pin), so unpublish/edit paths know
--     exactly which pins to delete or patch.

-- ─── 1. OAuth token store ────────────────────────────────────────────────────
--
-- Single-row table (id=1) keyed by a check constraint. Pinterest tokens
-- rotate every 30 days for access + 1 year for refresh; the weekly
-- refresh cron writes back here and everything else just reads.

CREATE TABLE public.pinterest_auth (
  id                     smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_token           text,
  refresh_token          text,
  access_token_expires_at   timestamptz,
  refresh_token_expires_at  timestamptz,
  scope                  text,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pinterest_auth IS
  'Single-row store for the Arco Pinterest business account OAuth tokens. Populated by the one-time OAuth bootstrap + rotated by the weekly refresh cron.';

CREATE TRIGGER pinterest_auth_updated_at
  BEFORE UPDATE ON public.pinterest_auth
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.pinterest_auth ENABLE ROW LEVEL SECURITY;

-- Admin-only read/write. Cron uses service role which bypasses RLS.
CREATE POLICY pinterest_auth_admin_all
  ON public.pinterest_auth FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── 2. Board mapping ────────────────────────────────────────────────────────
--
-- Polymorphic mapping: each row targets EITHER a space (space_id) OR a
-- project-type category (category_id), never both. Board id is nullable
-- so we can seed rows before the admin has entered Pinterest's board ids
-- (created manually on Pinterest first, then pasted into the admin UI).

CREATE TABLE public.pinterest_boards (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id       text UNIQUE,                                      -- Pinterest board id (opaque string). NULL = not yet mapped.
  board_name     text,                                              -- Display copy from Pinterest, for the admin UI.
  space_id       uuid REFERENCES public.spaces(id) ON DELETE CASCADE,
  category_id    uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK ((space_id IS NULL) <> (category_id IS NULL))
);

CREATE UNIQUE INDEX pinterest_boards_space_unique   ON public.pinterest_boards (space_id)    WHERE space_id    IS NOT NULL;
CREATE UNIQUE INDEX pinterest_boards_category_unique ON public.pinterest_boards (category_id) WHERE category_id IS NOT NULL;

COMMENT ON TABLE public.pinterest_boards IS
  'Maps an Arco space or a project-type category to its Pinterest board. Seeded with board_id=NULL; admin fills each board id in after creating the board manually on Pinterest.';

CREATE TRIGGER pinterest_boards_updated_at
  BEFORE UPDATE ON public.pinterest_boards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.pinterest_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY pinterest_boards_read
  ON public.pinterest_boards FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY pinterest_boards_admin_write
  ON public.pinterest_boards FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── 3. Sync state columns on projects + project_features ────────────────────

ALTER TABLE public.projects
  ADD COLUMN pinterest_pin_id      text UNIQUE,
  ADD COLUMN pinterest_synced_at   timestamptz,
  ADD COLUMN pinterest_sync_error  text;

COMMENT ON COLUMN public.projects.pinterest_pin_id IS
  'Pinterest pin id on the project-type board after a successful POST /pins. NULL = not synced or intentionally deleted.';

ALTER TABLE public.project_features
  ADD COLUMN pinterest_pin_id      text UNIQUE,
  ADD COLUMN pinterest_synced_at   timestamptz,
  ADD COLUMN pinterest_sync_error  text;

COMMENT ON COLUMN public.project_features.pinterest_pin_id IS
  'Pinterest pin id on the space board matching this feature''s space_id. NULL for features without a cover photo, in the exterior space, or before initial publish.';

-- ─── 4. Queue ────────────────────────────────────────────────────────────────
--
-- Decoupled work list drained by the /api/cron/process-pinterest-queue
-- worker every 5 minutes. `target_type` + `target_id` are a
-- discriminated union — the worker branches on target_type to read the
-- right source row.

CREATE TABLE public.pinterest_queue (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type    text NOT NULL CHECK (target_type IN ('project', 'feature')),
  target_id      uuid NOT NULL,
  action         text NOT NULL CHECK (action IN ('publish', 'delete', 'patch')),
  attempts       int NOT NULL DEFAULT 0,
  last_error     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  processed_at   timestamptz,
  cancelled_at   timestamptz,
  cancelled_reason text
);

-- Cron hot path: unfinished rows, oldest first, capped attempts.
CREATE INDEX pinterest_queue_pending_idx
  ON public.pinterest_queue (created_at)
  WHERE processed_at IS NULL AND cancelled_at IS NULL;

COMMENT ON TABLE public.pinterest_queue IS
  'Work queue for the Pinterest sync cron. Rows enqueued by triggers on projects.status / project_features. Drained every 5 minutes; retried up to 3 times before cancellation.';

ALTER TABLE public.pinterest_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY pinterest_queue_admin_read
  ON public.pinterest_queue FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ─── 5. Trigger fns ──────────────────────────────────────────────────────────
--
-- All triggers are best-effort — a failure to enqueue does NOT block
-- the underlying UPDATE/INSERT/DELETE. Missed rows can always be
-- back-filled by admin action; a spurious blocked publish is worse.

-- Enqueue a row iff no duplicate pending row already exists for this
-- (target_type, target_id, action). Prevents runaway queue growth
-- when a series of edits fires many triggers in quick succession.
CREATE OR REPLACE FUNCTION public.pinterest_enqueue(
  p_target_type text,
  p_target_id   uuid,
  p_action      text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pinterest_queue (target_type, target_id, action)
  SELECT p_target_type, p_target_id, p_action
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pinterest_queue
    WHERE target_type = p_target_type
      AND target_id = p_target_id
      AND action = p_action
      AND processed_at IS NULL
      AND cancelled_at IS NULL
  );
EXCEPTION WHEN OTHERS THEN
  -- Never block the underlying operation. Log via NOTICE only.
  RAISE NOTICE 'pinterest_enqueue failed: %', SQLERRM;
END;
$$;

-- Fired on projects.status transitions. Publish/delete cascades to
-- every eligible feature.
CREATE OR REPLACE FUNCTION public.pinterest_trg_projects_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  went_public boolean := (NEW.status = 'published' AND (OLD.status IS DISTINCT FROM 'published'));
  went_private boolean := (OLD.status = 'published' AND (NEW.status IS DISTINCT FROM 'published'));
  fid uuid;
BEGIN
  IF went_public THEN
    PERFORM public.pinterest_enqueue('project', NEW.id, 'publish');
    -- Fan out to every feature that has a cover photo and isn't the exterior space.
    FOR fid IN
      SELECT pf.id
      FROM public.project_features pf
      LEFT JOIN public.spaces s ON s.id = pf.space_id
      WHERE pf.project_id = NEW.id
        AND pf.cover_photo_id IS NOT NULL
        AND (s.slug IS NULL OR s.slug <> 'exterior')
    LOOP
      PERFORM public.pinterest_enqueue('feature', fid, 'publish');
    END LOOP;
  ELSIF went_private THEN
    -- Only enqueue delete for rows we actually stamped previously; a
    -- draft project that never published has no pins to remove.
    IF NEW.pinterest_pin_id IS NOT NULL THEN
      PERFORM public.pinterest_enqueue('project', NEW.id, 'delete');
    END IF;
    FOR fid IN
      SELECT id FROM public.project_features
      WHERE project_id = NEW.id AND pinterest_pin_id IS NOT NULL
    LOOP
      PERFORM public.pinterest_enqueue('feature', fid, 'delete');
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pinterest_projects_status
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.pinterest_trg_projects_status();

-- Fired on projects.title / description edits while published — patch
-- text on the type pin + every sibling space pin.
CREATE OR REPLACE FUNCTION public.pinterest_trg_projects_text()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fid uuid;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  IF (NEW.title IS NOT DISTINCT FROM OLD.title)
     AND (NEW.description IS NOT DISTINCT FROM OLD.description) THEN
    RETURN NEW;
  END IF;
  IF NEW.pinterest_pin_id IS NOT NULL THEN
    PERFORM public.pinterest_enqueue('project', NEW.id, 'patch');
  END IF;
  FOR fid IN
    SELECT id FROM public.project_features
    WHERE project_id = NEW.id AND pinterest_pin_id IS NOT NULL
  LOOP
    PERFORM public.pinterest_enqueue('feature', fid, 'patch');
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pinterest_projects_text
  AFTER UPDATE OF title, description ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.pinterest_trg_projects_text();

-- Fired on project_features INSERT / UPDATE / DELETE while the parent
-- project is published. Handles: new feature added → publish;
-- cover_photo_id changed → delete + publish; feature deleted → delete.
CREATE OR REPLACE FUNCTION public.pinterest_trg_features()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_published boolean;
  space_slug text;
  eligible boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.pinterest_pin_id IS NOT NULL THEN
      PERFORM public.pinterest_enqueue('feature', OLD.id, 'delete');
    END IF;
    RETURN OLD;
  END IF;

  SELECT (status = 'published') INTO project_published
  FROM public.projects WHERE id = NEW.project_id;
  IF NOT project_published THEN RETURN NEW; END IF;

  SELECT slug INTO space_slug FROM public.spaces WHERE id = NEW.space_id;
  eligible := NEW.cover_photo_id IS NOT NULL
              AND (space_slug IS NULL OR space_slug <> 'exterior');

  IF TG_OP = 'INSERT' THEN
    IF eligible THEN
      PERFORM public.pinterest_enqueue('feature', NEW.id, 'publish');
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: cover swap → delete + publish; eligibility change → publish or delete.
  IF NEW.cover_photo_id IS DISTINCT FROM OLD.cover_photo_id
     OR NEW.space_id IS DISTINCT FROM OLD.space_id THEN
    IF OLD.pinterest_pin_id IS NOT NULL THEN
      PERFORM public.pinterest_enqueue('feature', NEW.id, 'delete');
    END IF;
    IF eligible THEN
      PERFORM public.pinterest_enqueue('feature', NEW.id, 'publish');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pinterest_features_ins
  AFTER INSERT ON public.project_features
  FOR EACH ROW EXECUTE FUNCTION public.pinterest_trg_features();

CREATE TRIGGER pinterest_features_upd
  AFTER UPDATE OF cover_photo_id, space_id ON public.project_features
  FOR EACH ROW EXECUTE FUNCTION public.pinterest_trg_features();

CREATE TRIGGER pinterest_features_del
  BEFORE DELETE ON public.project_features
  FOR EACH ROW EXECUTE FUNCTION public.pinterest_trg_features();

-- ─── 6. Seed board rows ──────────────────────────────────────────────────────
--
-- board_id starts NULL for every row — admin populates each after
-- creating the corresponding board on Pinterest. Type boards cover the
-- residential categories we currently list; space boards cover every
-- non-Exterior space slug.

INSERT INTO public.pinterest_boards (category_id, board_name)
SELECT id, name FROM public.categories
WHERE category_type = 'Project'
  AND slug IN ('villa', 'townhouse', 'chalet', 'garden-house', 'bungalow', 'apartment', 'penthouse', 'farm', 'house', 'extension')
ON CONFLICT DO NOTHING;

INSERT INTO public.pinterest_boards (space_id, board_name)
SELECT id, name FROM public.spaces
WHERE is_active = true
  AND slug <> 'exterior'
ON CONFLICT DO NOTHING;

-- Seed the auth row so UPDATE writes from OAuth bootstrap work without
-- an explicit INSERT.
INSERT INTO public.pinterest_auth (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
