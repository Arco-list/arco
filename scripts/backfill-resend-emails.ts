/**
 * Backfill historical Resend sends into email_events.
 *
 * The sendTransactionalEmail wrapper only catches sends going forward.
 * This script paginates Resend's emails.list() endpoint and inserts a
 * `sent` row per historical email so analytics queries against
 * email_events cover the full history rather than just post-deploy data.
 *
 * Idempotent: keyed on (provider='resend', provider_event_id=<resend message id>).
 * Re-running is safe — the UNIQUE constraint dedupes against existing rows.
 *
 * Run from project root:
 *   npx tsx --env-file=.env.local scripts/backfill-resend-emails.ts
 *
 * Optional env:
 *   BACKFILL_MAX=5000      # cap total rows pulled (default 5000)
 *   BACKFILL_SINCE=2025-01-01  # only backfill rows created on/after this date
 */
import { Resend } from "resend"
import { createClient } from "@supabase/supabase-js"

type ResendListRow = {
  id: string
  from?: string
  to?: string[] | string
  subject?: string
  created_at?: string
  last_event?: string
  tags?: Array<{ name: string; value: string }> | Record<string, string> | null
}

function extractTag(tags: ResendListRow["tags"], name: string): string | null {
  if (!tags) return null
  if (Array.isArray(tags)) {
    return tags.find((t) => t?.name === name)?.value ?? null
  }
  // Tags can come back as a flat record from Resend
  const v = (tags as Record<string, string>)[name]
  return typeof v === "string" ? v : null
}

// Subject-regex fallback for backfilled rows where Resend's `emails.list()`
// endpoint doesn't return tags (which means `template` comes back null).
// Mirrors SUBJECT_TO_TEMPLATE in app/[locale]/admin/emails/actions.ts; keep
// in sync if patterns change there. Order matters: most-specific first so
// prospect-followup's "op Arco$" catch-all doesn't swallow invite subjects.
const SUBJECT_KIND_PATTERNS: Array<[RegExp, "invite" | "sales_outbound"]> = [
  // invite — new-professional-invite (claim flow)
  [/credited you on Arco$/i, "invite"],
  [/heeft je vermeld op Arco$/i, "invite"],
  // invite — professional-invite (claimed user variant)
  [/credited you on /i, "invite"],
  [/ heeft je vermeld op /i, "invite"],
  // sales_outbound — prospect-final
  [/^Claim .* op Arco$/i, "sales_outbound"],
  [/^Claim .* on Arco$/i, "sales_outbound"],
  // sales_outbound — prospect-intro
  [/Een podium voor/i, "sales_outbound"],
  [/^A stage for /i, "sales_outbound"],
  // sales_outbound — prospect-followup (catch-all)
  [/op Arco$/i, "sales_outbound"],
  [/ on Arco$/i, "sales_outbound"],
]

function deriveCampaignKind(template: string | null, subject: string | null): string {
  if (template) {
    if (template.startsWith("prospect-")) return "sales_outbound"
    if (template === "professional-invite" || template.startsWith("new-professional-")) {
      return "invite"
    }
    return "transactional"
  }
  // Tag missing — try to recover the categorization from the subject line.
  if (subject) {
    for (const [pattern, kind] of SUBJECT_KIND_PATTERNS) {
      if (pattern.test(subject)) return kind
    }
  }
  return "transactional"
}

async function main() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY missing")
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing")
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing")

  const max = Number(process.env.BACKFILL_MAX ?? 5000)
  const sinceIso = process.env.BACKFILL_SINCE
    ? new Date(process.env.BACKFILL_SINCE).toISOString()
    : undefined

  const resend = new Resend(process.env.RESEND_API_KEY)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  console.log(`→ Backfilling Resend sends (max=${max}, since=${sinceIso ?? "all-time"})...`)

  const rows: ResendListRow[] = []
  let after: string | undefined
  const pageSize = 100
  const maxPages = Math.ceil(max / pageSize)

  for (let page = 0; page < maxPages; page++) {
    const opts: { limit: number; after?: string } = { limit: pageSize }
    if (after) opts.after = after
    const { data, error } = await resend.emails.list(opts)
    if (error) {
      console.error(`✗ Resend list page ${page} failed:`, error)
      break
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batch: ResendListRow[] = (data as any)?.data ?? []
    if (batch.length === 0) break

    let hitCutoff = false
    for (const r of batch) {
      if (sinceIso && r.created_at && new Date(r.created_at) < new Date(sinceIso)) {
        hitCutoff = true
        break
      }
      rows.push(r)
      if (rows.length >= max) break
    }
    if (hitCutoff || rows.length >= max) break
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(data as any)?.has_more) break
    const lastId = batch[batch.length - 1]?.id
    if (!lastId) break
    after = lastId
  }

  console.log(`  fetched ${rows.length} Resend rows`)

  // Build email_events inserts per Resend row. Idempotent on
  // (provider, provider_event_id) — re-running this script is safe.
  // Each row produces:
  //   - one 'sent' event (always)
  //   - one engagement event matching last_event (delivered/opened/clicked/
  //     bounced) — Resend stores the highest-state per email, which is
  //     enough to power the highest-state-per-message aggregation in the
  //     dashboard. Intermediate states are lost but the dashboard doesn't
  //     surface them anyway.
  const ENGAGEMENT_TYPES = new Set(["delivered", "opened", "clicked", "bounced", "complained", "failed"])
  let inserted = 0
  let skipped = 0
  let errors = 0

  // Batch inserts in chunks of 100 to avoid hitting Supabase row limits
  const CHUNK = 100
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const payload: Array<Record<string, unknown>> = []

    for (const r of chunk) {
      const recipient = Array.isArray(r.to) ? r.to[0] : r.to
      if (!recipient || !r.id) continue
      const template = extractTag(r.tags, "template")
      const locale = extractTag(r.tags, "locale")
      const occurredAt = r.created_at ?? new Date().toISOString()

      // Always: the 'sent' row
      payload.push({
        provider: "resend",
        provider_event_id: r.id,
        event_type: "sent",
        recipient_email: recipient,
        campaign_kind: deriveCampaignKind(template, r.subject ?? null),
        template,
        subject: r.subject ?? null,
        locale,
        occurred_at: occurredAt,
        metadata: { resend_message_id: r.id, backfilled: true },
      })

      // Optional: engagement row reflecting last_event
      const lastEvent = (r.last_event ?? "sent").toLowerCase()
      if (ENGAGEMENT_TYPES.has(lastEvent)) {
        payload.push({
          provider: "resend",
          provider_event_id: `${r.id}:${lastEvent}:backfill`,
          event_type: lastEvent,
          recipient_email: recipient,
          subject: r.subject ?? null,
          // Apollo doesn't tell us when each event happened — only that the
          // message reached this state. Pin to the send time as the best
          // available approximation. Will be wrong if the open happened
          // weeks later, but the bucketed aggregations don't notice.
          occurred_at: occurredAt,
          metadata: { resend_message_id: r.id, backfilled: true, source: "list_last_event" },
        })
      }
    }

    if (payload.length === 0) {
      skipped += chunk.length
      continue
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("email_events")
      .upsert(payload, {
        onConflict: "provider,provider_event_id",
        ignoreDuplicates: true,
      })

    if (error) {
      errors++
      console.error(`  chunk ${i}-${i + chunk.length} insert error:`, error.message)
    } else {
      inserted += payload.length
    }
  }

  console.log(`✓ Backfill complete:`)
  console.log(`  fetched:  ${rows.length}`)
  console.log(`  inserted: ${inserted} (re-runs may report inserted but row count unchanged due to upsert dedup)`)
  console.log(`  skipped:  ${skipped} (missing recipient or message id)`)
  console.log(`  errors:   ${errors}`)
}

main().catch((err) => {
  console.error("Script error:", err)
  process.exit(1)
})
