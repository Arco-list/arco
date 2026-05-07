-- Inbox / Gmail integration foundation. Slice 1 + 2 of the /admin/inbox
-- build: OAuth-stored Gmail connections + an inbound_emails table fed
-- by a 5-minute cron, with a replied_at column on prospects so a reply
-- to any Showcase / Outreach / Welcome / Invite send auto-cancels the
-- pending drip rows.

-- ── Gmail OAuth connections ────────────────────────────────────────────
-- One row per connected mailbox. We start with a single mailbox
-- (niek@arcolist.com) but the table is keyed by user_id so adding
-- per-rep mailboxes later is just more rows.
--
-- refresh_token is encrypted at the application layer (AES-256-GCM
-- with GMAIL_TOKEN_ENCRYPTION_KEY). Stored as text since the encrypted
-- payload is base64url. last_history_id drives the incremental sync —
-- on the first run we initialise it from Gmail's profile endpoint, then
-- every subsequent run pulls /history?startHistoryId=<last_history_id>.
CREATE TABLE IF NOT EXISTS public.gmail_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_address text NOT NULL,
  refresh_token text NOT NULL,
  -- Most recent access token + its expiry. The cron refreshes when
  -- expired; storing here avoids a refresh roundtrip on every run.
  access_token text,
  access_token_expires_at timestamptz,
  -- Gmail historyId we've successfully synced through. NULL until the
  -- first sync run; we initialise from /users/me/profile on the first
  -- pass, then incrementally advance.
  last_history_id text,
  last_sync_at timestamptz,
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Only one active connection per gmail_address. Disconnect + reconnect
  -- replaces the row via ON CONFLICT in the OAuth callback.
  CONSTRAINT gmail_connections_address_unique UNIQUE (gmail_address)
);

CREATE INDEX IF NOT EXISTS idx_gmail_connections_user_id
  ON public.gmail_connections(user_id);

-- ── Inbound emails ─────────────────────────────────────────────────────
-- Mirror of Gmail messages we've synced. One row per message-id; matched
-- to a prospect at sync time when from_email maps to a known prospect.
-- The /admin/inbox UI reads from here.
CREATE TABLE IF NOT EXISTS public.inbound_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Source provider — 'gmail' for now; 'resend_inbound' when we move
  -- ingestion to Resend Inbound on a reply subdomain.
  provider text NOT NULL DEFAULT 'gmail',
  -- Per-provider unique message id (Gmail's RFC 5322 message-id, base64).
  -- Idempotency key for the sync upsert.
  provider_message_id text NOT NULL,
  -- Conversation grouping (Gmail threadId). Kept so the reply composer
  -- can post to the same thread later.
  thread_id text,
  from_email text NOT NULL,
  from_name text,
  to_emails text[] NOT NULL DEFAULT '{}',
  subject text,
  snippet text,
  body_text text,
  body_html text,
  received_at timestamptz NOT NULL,
  -- Resolved at sync time when from_email matches a prospect. Null when
  -- the sender isn't a prospect (could still be useful inbox content).
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  -- 'unread' | 'read' | 'replied' | 'archived'. Drives the inbox filters.
  status text NOT NULL DEFAULT 'unread',
  replied_at timestamptz,
  -- Cached AI-generated draft so we don't re-call the model on every
  -- compose-panel open.
  ai_draft_text text,
  -- Anything provider-specific we want to keep raw (e.g. full headers,
  -- labels, attachments metadata) without a schema migration.
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inbound_emails_provider_message_unique
    UNIQUE (provider, provider_message_id)
);

CREATE INDEX IF NOT EXISTS idx_inbound_emails_received_at
  ON public.inbound_emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_prospect_id
  ON public.inbound_emails(prospect_id)
  WHERE prospect_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inbound_emails_status
  ON public.inbound_emails(status);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_from_email
  ON public.inbound_emails(LOWER(from_email));

-- ── Prospect replied_at ───────────────────────────────────────────────
-- Fed by the inbound sync — first inbound from a prospect's email
-- stamps this. isOptedOutOfMarketing already gates on bounced /
-- complained / unsubscribed; admins can decide whether replied_at also
-- gates future sends (today: just informational + drip cancel).
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS replied_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_prospects_replied_at
  ON public.prospects(replied_at)
  WHERE replied_at IS NOT NULL;
