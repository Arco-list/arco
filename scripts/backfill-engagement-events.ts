/**
 * Backfill engagement events into email_events from existing per-table caches.
 *
 * Why: Resend's webhooks fire only on new sends — historical engagement
 * (delivered/opened/clicked/bounced) for emails sent before email_events
 * was wired aren't replayed. But those events ARE captured in the per-table
 * caches (company_outreach.last_event_cached, email_drip_queue.last_event_cached)
 * that the existing webhook handler has been writing for months.
 *
 * This script reads those caches and inserts equivalent engagement rows
 * into email_events, keyed on the resend message id so they join correctly
 * with the 'sent' rows from the previous backfill.
 *
 * Idempotent on (provider, provider_event_id). Re-running is safe.
 *
 * Run from project root:
 *   npx tsx --env-file=.env.local scripts/backfill-engagement-events.ts
 */
import { createClient } from "@supabase/supabase-js"

// Resend's `last_event_cached` values → our event_type enum.
// 'sent' is excluded — those rows are already covered by the Resend backfill.
// 'suppressed' maps to 'failed' (the email never reached the inbox).
const EVENT_MAP: Record<string, string> = {
  delivered: "delivered",
  opened: "opened",
  clicked: "clicked",
  bounced: "bounced",
  complained: "complained",
  failed: "failed",
  suppressed: "failed",
}

type CachedRow = {
  resend_message_id: string
  last_event_cached: string
  last_event_cached_at: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function backfillFrom(
  supabase: any,
  table: string,
): Promise<{ scanned: number; upserted: number; skipped: number; errors: number }> {
  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from(table as any)
    .select("resend_message_id, last_event_cached, last_event_cached_at")
    .not("resend_message_id", "is", null)
    .not("last_event_cached", "is", null)

  if (error) {
    console.error(`✗ ${table} read failed:`, error.message)
    return { scanned: 0, upserted: 0, skipped: 0, errors: 1 }
  }

  const rows = (data ?? []) as unknown as CachedRow[]
  let upserted = 0
  let skipped = 0
  let errors = 0

  // Batch in chunks to avoid huge inserts.
  const CHUNK = 100
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const payload = chunk
      .map((r) => {
        const eventType = EVENT_MAP[r.last_event_cached]
        if (!eventType) return null
        const occurredAt = r.last_event_cached_at ?? new Date().toISOString()
        return {
          provider: "resend",
          provider_event_id: `${r.resend_message_id}:${eventType}:backfill`,
          event_type: eventType,
          recipient_email: "",
          occurred_at: occurredAt,
          metadata: {
            resend_message_id: r.resend_message_id,
            backfilled_from: table,
          },
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)

    skipped += chunk.length - payload.length
    if (payload.length === 0) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertErr } = await (supabase as any)
      .from("email_events")
      .upsert(payload, {
        onConflict: "provider,provider_event_id",
        ignoreDuplicates: true,
      })

    if (upsertErr) {
      errors++
      console.error(`  chunk ${i} upsert error:`, upsertErr.message)
    } else {
      upserted += payload.length
    }
  }

  return { scanned: rows.length, upserted, skipped, errors }
}

// Backfill recipient_email on engagement rows by looking up the corresponding
// 'sent' row (which has the actual recipient). PostgREST doesn't support
// JOINs directly, so we do it in two passes: pull engagement rows missing
// recipient, look up their sent counterparts, update.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fillRecipientEmails(supabase: any): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gaps } = await (supabase as any)
    .from("email_events")
    .select("id, metadata")
    .eq("provider", "resend")
    .neq("event_type", "sent")
    .eq("recipient_email", "")

  if (!gaps || gaps.length === 0) return 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messageIds: string[] = gaps
    .map((g: any) => g.metadata?.resend_message_id)
    .filter((m: unknown): m is string => typeof m === "string")
  if (messageIds.length === 0) return 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sends } = await (supabase as any)
    .from("email_events")
    .select("provider_event_id, recipient_email")
    .eq("provider", "resend")
    .eq("event_type", "sent")
    .in("provider_event_id", messageIds)

  const emailByMsg = new Map<string, string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (sends ?? []) as any[]) {
    if (s.recipient_email) emailByMsg.set(s.provider_event_id, s.recipient_email)
  }

  let updated = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const g of gaps as any[]) {
    const email = emailByMsg.get(g.metadata?.resend_message_id)
    if (!email) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("email_events")
      .update({ recipient_email: email })
      .eq("id", g.id)
    if (!error) updated++
  }
  return updated
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing")
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  console.log("→ Backfilling engagement events from company_outreach...")
  const a = await backfillFrom(supabase, "company_outreach")
  console.log(`  scanned: ${a.scanned}, upserted: ${a.upserted}, skipped: ${a.skipped}, errors: ${a.errors}`)

  console.log("→ Backfilling engagement events from email_drip_queue...")
  const b = await backfillFrom(supabase, "email_drip_queue")
  console.log(`  scanned: ${b.scanned}, upserted: ${b.upserted}, skipped: ${b.skipped}, errors: ${b.errors}`)

  console.log("→ Filling recipient_email on engagement rows...")
  const filled = await fillRecipientEmails(supabase)
  console.log(`  updated: ${filled}`)

  console.log(`\n✓ Backfill complete. Re-run /admin/emails to see updated last_event values.`)
}

main().catch((err) => {
  console.error("Script error:", err)
  process.exit(1)
})
