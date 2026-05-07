import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { updateContactStage, updateAccountStage } from "@/lib/apollo-client"
import { logger } from "@/lib/logger"

const APOLLO_API_URL = "https://api.apollo.io/api/v1"

function getApiKey() {
  const key = process.env.APOLLO_API_KEY
  if (!key) throw new Error("APOLLO_API_KEY is not set")
  return key
}

async function apolloRequest(path: string, options: RequestInit = {}) {
  const res = await fetch(`${APOLLO_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": getApiKey(),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    logger.error("Apollo API error", { path, status: res.status, body })
    throw new Error(`Apollo API ${res.status}: ${body}`)
  }

  return res.json()
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApolloContact {
  id: string
  email: string
  first_name?: string
  last_name?: string
  organization_name?: string
  phone_numbers?: Array<{ raw_number: string }>
  city?: string
  country?: string
  website_url?: string
}


// ─── Sync contacts from an Apollo list ──────────────────────────────────────

export async function syncApolloList(listId: string): Promise<{ synced: number; errorCount: number; lastError: string | null }> {
  const supabase = createServiceRoleSupabaseClient()
  let page = 1
  let totalSynced = 0
  let errorCount = 0
  let lastError: string | null = null
  let hasMore = true

  while (hasMore) {
    const data = await apolloRequest("/contacts/search", {
      method: "POST",
      body: JSON.stringify({
        contact_label_ids: [listId],
        page,
        per_page: 100,
      }),
    })

    const contacts: ApolloContact[] = data.contacts ?? []

    if (contacts.length === 0) {
      hasMore = false
      break
    }

    for (const contact of contacts) {
      if (!contact.email) continue

      const contactName = [contact.first_name, contact.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || null

      const { error } = await supabase
        .from("prospects")
        .upsert(
          {
            email: contact.email.toLowerCase(),
            contact_name: contactName,
            company_name: contact.organization_name || null,
            phone: contact.phone_numbers?.[0]?.raw_number || null,
            city: contact.city || null,
            country: contact.country || "Netherlands",
            website: contact.website_url || null,
            apollo_contact_id: contact.id,
            apollo_list_id: listId,
            source: "apollo",
          },
          // Matches the prospects_email_source_key UNIQUE (email, source)
          // constraint. A plain `email` key would collide with the arco
          // and invites source rows that legitimately share the email.
          { onConflict: "email,source" }
        )

      if (error) {
        errorCount++
        lastError = error.message ?? String(error)
        logger.error("Failed to upsert prospect from Apollo", { email: contact.email, error })
      } else {
        totalSynced++
      }
    }

    // Apollo pagination
    const totalPages = Math.ceil((data.pagination?.total_entries ?? 0) / 100)
    hasMore = page < totalPages
    page++
  }

  logger.info("Apollo list sync complete", { listId, totalSynced, errorCount })
  return { synced: totalSynced, errorCount, lastError }
}

// ─── Sync email activity for all active prospects ───────────────────────────

export async function syncApolloActivity(): Promise<{ updated: number; total: number; errorCount: number; lastError: string | null }> {
  const supabase = createServiceRoleSupabaseClient()

  // Get all prospects with an Apollo contact ID that aren't terminal
  const { data: prospects, error } = await supabase
    .from("prospects")
    .select("id, email, apollo_contact_id, status, emails_sent")
    .not("apollo_contact_id", "is", null)
    .not("status", "eq", "active")
    .order("updated_at", { ascending: true })
    .limit(100) // Process in batches to avoid rate limits

  if (error || !prospects) {
    logger.error("Failed to fetch prospects for activity sync", { error })
    return { updated: 0, total: 0, errorCount: 1, lastError: error?.message ?? "fetch failed" }
  }

  let updated = 0
  let errorCount = 0
  let lastError: string | null = null

  for (const prospect of prospects as any[]) {
    try {
      // Fetch contact details from Apollo (includes email activity)
      const data = await apolloRequest(`/contacts/${prospect.apollo_contact_id}`)
      const contact = data.contact as ApolloContact

      if (!contact) continue

      // Extract engagement data from contact_campaign_statuses
      const campaignStatuses = (contact as any).contact_campaign_statuses ?? []
      let totalSent = 0
      let sequenceId: string | null = null
      let sequenceStatus = "not_started"

      for (const cs of campaignStatuses) {
        // current_step_position = number of steps completed (emails sent)
        const stepsSent = cs.current_step_position ?? 0
        totalSent += stepsSent
        if (!sequenceId && cs.emailer_campaign_id) sequenceId = cs.emailer_campaign_id

        // Map Apollo sequence status to our sequence_status
        if (cs.status === "finished") {
          sequenceStatus = "finished"
        } else if (cs.status === "active" || cs.status === "paused") {
          // Only override if not already finished by another campaign
          if (sequenceStatus !== "finished") sequenceStatus = "active"
        }
      }

      // If no campaign statuses but has campaign IDs, they're queued (not started yet)
      const campaignIds = (contact as any).emailer_campaign_ids ?? []
      if (campaignStatuses.length === 0 && campaignIds.length > 0) {
        sequenceStatus = "active"
        if (!sequenceId) sequenceId = campaignIds[0]
      }

      // Store Apollo email status and calculate delivered
      const emailStatus = (contact as any).email_status ?? "unknown"
      // Delivered = sent emails where email is verified and no failure
      const hasFailed = campaignStatuses.some((cs: any) => cs.failure_reason)
      const delivered = (emailStatus === "verified" && !hasFailed) ? totalSent : 0

      // Determine new prospect status based on activity
      const STATUS_ORDER = [
        "prospect", "contacted", "visitor", "signup",
        "company", "active",
      ]
      const currentIdx = STATUS_ORDER.indexOf(prospect.status)

      let newStatus = prospect.status
      // Only advance to contacted if email was delivered
      if (delivered > 0 && currentIdx < STATUS_ORDER.indexOf("contacted")) {
        newStatus = "contacted"
      }

      // Build update
      const updates: Record<string, any> = {
        emails_sent: totalSent,
        emails_delivered: delivered,
        status: newStatus,
        sequence_status: sequenceStatus,
        email_status: emailStatus,
      }

      if (sequenceId) updates.apollo_sequence_id = sequenceId
      // Note: do NOT set last_email_sent_at = now() here. That used to be
      // the case but it drifted to "last cron run" rather than "actual last
      // send". The correct value is derived from email_events.occurred_at
      // by recomputeProspectLastEmailSentAt() — invoked from the cron route
      // after syncApolloEmailEvents() populates per-message timestamps.

      const { error: updateError } = await supabase
        .from("prospects")
        .update(updates)
        .eq("id", prospect.id)

      if (updateError) {
        logger.error("Failed to update prospect activity", { id: prospect.id, error: updateError })
      } else {
        // Log event if status changed
        if (newStatus !== prospect.status) {
          await supabase.from("prospect_events").insert({
            prospect_id: prospect.id,
            event_type: `status_changed_to_${newStatus}`,
            event_source: "apollo_sync",
            old_status: prospect.status,
            new_status: newStatus,
            metadata: { emails_sent: totalSent, sequence_status: sequenceStatus },
          })
        }

        // Always sync current Arco status → Apollo stage (catches cases where Arco is ahead)
        const stageMap: Record<string, string> = {
          prospect: "Prospect", contacted: "Contacted", visitor: "Visitor",
          signup: "Signup", company: "Draft", active: "Listed",
        }
        const stageName = stageMap[newStatus]
        if (stageName) {
          try {
            await Promise.all([
              updateContactStage(prospect.apollo_contact_id, stageName),
              updateAccountStage(prospect.apollo_contact_id, stageName),
            ])
          } catch (err) {
            logger.error("Failed to sync Apollo stage during activity sync", { id: prospect.id }, err as Error)
          }
        }

        updated++
      }

      // Apollo's free plan caps /contacts/show at 50 calls/minute. 1300ms
      // = ~46 calls/minute, comfortably under the ceiling. The previous
      // 700ms (~85 calls/min) reliably tripped 429s after the 30th call.
      await new Promise((r) => setTimeout(r, 1300))
    } catch (err) {
      errorCount++
      lastError = err instanceof Error ? err.message : String(err)
      logger.error("Failed to sync activity for prospect", { id: prospect.id, error: err })
    }
  }

  logger.info("Apollo activity sync complete", { updated, total: prospects.length, errorCount })
  return { updated, total: prospects.length, errorCount, lastError }
}

// ─── Per-message email_events sync ─────────────────────────────────────────

/**
 * Materialize per-message Apollo email events into the unified email_events
 * table. Replaces the `prospects.last_email_sent_at` aggregate as the source
 * for any metric that needs accurate per-send bucketing (e.g., growth-table
 * "Sales pros contacted").
 *
 * One run pulls every message across every active campaign that any prospect
 * is enrolled in, then upserts:
 *   - 'sent' rows for messages with `completed_at`
 *   - 'bounced' / 'failed' rows for messages whose status indicates failure
 *
 * Idempotency: provider_event_id = `apollo:${msg.id}` for sent,
 * `apollo:${msg.id}:bounced` / `:failed` for engagement. Upsert on the
 * unique (provider, provider_event_id) constraint, so re-runs are no-ops for
 * already-synced messages.
 *
 * Apollo's `emailer_messages/search` doesn't expose per-event open/click
 * timestamps — only aggregate counts on the contact — so we don't emit
 * 'opened' / 'clicked' rows from this path. Resend webhooks remain the
 * source for those when we send through Resend; the Apollo side is sales-
 * outbound only and we accept the gap.
 */
export async function syncApolloEmailEvents(): Promise<{
  campaignsScanned: number
  messagesProcessed: number
  eventsUpserted: number
  errorCount: number
  lastError: string | null
}> {
  const supabase = createServiceRoleSupabaseClient()

  // Build contact_id → (email, prospect_id) map up front to avoid an Apollo
  // contact-fetch per message. Apollo messages reference `contact_id`; we
  // already have that mapping in our prospects table.
  const { data: prospectsRaw } = await supabase
    .from("prospects")
    .select("id, email, apollo_contact_id, apollo_sequence_id")
    .not("apollo_contact_id", "is", null)
  const prospectsList = (prospectsRaw ?? []) as Array<{
    id: string; email: string; apollo_contact_id: string; apollo_sequence_id: string | null
  }>

  const contactIdToProspect = new Map<string, { id: string; email: string }>()
  const campaignIds = new Set<string>()
  for (const p of prospectsList) {
    if (p.apollo_contact_id && p.email) {
      contactIdToProspect.set(p.apollo_contact_id, { id: p.id, email: p.email })
    }
    if (p.apollo_sequence_id) campaignIds.add(p.apollo_sequence_id)
  }

  if (campaignIds.size === 0) {
    return { campaignsScanned: 0, messagesProcessed: 0, eventsUpserted: 0, errorCount: 0, lastError: null }
  }

  let messagesProcessed = 0
  let eventsUpserted = 0
  let errorCount = 0
  let lastError: string | null = null

  for (const campaignId of campaignIds) {
    try {
      // Paginate every message in the campaign. Cap at 5 pages × 100 = 500
      // messages to bound runtime per campaign — large campaigns need a
      // different design (cursor-based incremental sync).
      const messages: any[] = []
      for (let page = 1; page <= 5; page++) {
        const data = await apolloRequest("/emailer_messages/search", {
          method: "POST",
          body: JSON.stringify({
            q_emailer_campaign_ids: [campaignId],
            page,
            per_page: 100,
          }),
        })
        const batch: any[] = data?.emailer_messages ?? []
        messages.push(...batch)
        const total = data?.pagination?.total_entries ?? messages.length
        if (messages.length >= total || batch.length < 100) break
        // Light throttle between pages to stay polite on the API.
        await new Promise((r) => setTimeout(r, 200))
      }

      for (const m of messages) {
        messagesProcessed++
        const contactInfo = contactIdToProspect.get(m.contact_id)
        if (!contactInfo) continue // Apollo contact not in our prospects table

        const status = String(m.status ?? "").toLowerCase()
        const subject = (m.subject as string | null) ?? null
        const campaignPos = (m.campaign_position as number | null) ?? null
        const baseRow = {
          provider: "apollo",
          recipient_email: contactInfo.email,
          prospect_id: contactInfo.id,
          campaign_kind: "sales_outbound",
          campaign_id: campaignId,
          campaign_position: campaignPos,
          subject,
          metadata: {
            apollo_message_id: m.id,
            apollo_contact_id: m.contact_id,
            apollo_status: m.status ?? null,
          },
        }

        // 'sent' event: any message with a completed_at timestamp.
        if (m.completed_at && (status === "completed" || status === "sent")) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any).from("email_events").upsert(
            {
              ...baseRow,
              provider_event_id: `apollo:${m.id}`,
              event_type: "sent",
              occurred_at: m.completed_at,
            },
            { onConflict: "provider,provider_event_id" },
          )
          if (error) {
            errorCount++
            lastError = error.message
            logger.error("[apollo-email-events] sent upsert failed", { msgId: m.id, error: error.message })
          } else {
            eventsUpserted++
          }
        }

        // 'bounced' event: failure indicators. Apollo flags these via
        // status='bounced' or a non-null bounced_at on the message.
        if (status === "bounced" || m.bounced_at) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any).from("email_events").upsert(
            {
              ...baseRow,
              provider_event_id: `apollo:${m.id}:bounced`,
              event_type: "bounced",
              occurred_at: m.bounced_at ?? m.completed_at ?? new Date().toISOString(),
            },
            { onConflict: "provider,provider_event_id" },
          )
          if (error) {
            errorCount++
            lastError = error.message
          } else {
            eventsUpserted++
          }
        }

        // 'failed' event: terminal non-bounce failure (e.g., suppression list,
        // no_email_on_record, unsubscribed).
        if (status === "failed" || m.failure_reason) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any).from("email_events").upsert(
            {
              ...baseRow,
              provider_event_id: `apollo:${m.id}:failed`,
              event_type: "failed",
              occurred_at: m.completed_at ?? new Date().toISOString(),
              metadata: {
                ...baseRow.metadata,
                failure_reason: m.failure_reason ?? m.not_sent_reason ?? null,
              },
            },
            { onConflict: "provider,provider_event_id" },
          )
          if (error) {
            errorCount++
            lastError = error.message
          } else {
            eventsUpserted++
          }
        }
      }
    } catch (err) {
      errorCount++
      lastError = err instanceof Error ? err.message : String(err)
      logger.error("[apollo-email-events] campaign sync failed", { campaignId, error: lastError })
    }
  }

  logger.info("[apollo-email-events] sync complete", {
    campaignsScanned: campaignIds.size,
    messagesProcessed,
    eventsUpserted,
    errorCount,
  })
  return {
    campaignsScanned: campaignIds.size,
    messagesProcessed,
    eventsUpserted,
    errorCount,
    lastError,
  }
}

// ─── Refresh prospects.last_email_sent_at from email_events ─────────────────

/**
 * Recompute prospects.last_email_sent_at from the canonical email_events
 * sent timestamps. Run after syncApolloEmailEvents (and any Resend-side
 * sales_outbound send) so the prospect cache reflects the real "last
 * contacted" time rather than the last cron run.
 *
 * Matches by lowercased email — prospects.email is treated as canonical.
 * Captures both Apollo and Resend sales_outbound sends since both write
 * email_events with campaign_kind='sales_outbound'.
 */
export async function recomputeProspectLastEmailSentAt(): Promise<{ updated: number; error: string | null }> {
  const supabase = createServiceRoleSupabaseClient()

  // Use a CTE-style update via PostgREST. PostgREST doesn't expose CTEs
  // directly, so we do it in two passes: pull max(occurred_at) per email
  // from email_events, then update prospects in a batch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxRows, error: readErr } = await (supabase as any)
    .from("email_events")
    .select("recipient_email, occurred_at")
    .eq("event_type", "sent")
    .eq("campaign_kind", "sales_outbound")
    .neq("recipient_email", "")

  if (readErr) {
    logger.error("[apollo-email-events] recompute read failed", { error: readErr.message })
    return { updated: 0, error: readErr.message }
  }

  // Build email → max(occurred_at) map.
  const maxByEmail = new Map<string, string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (maxRows ?? []) as any[]) {
    const key = String(r.recipient_email).toLowerCase()
    const ts = r.occurred_at as string
    const existing = maxByEmail.get(key)
    if (!existing || ts > existing) maxByEmail.set(key, ts)
  }

  if (maxByEmail.size === 0) return { updated: 0, error: null }

  // Pull current prospect timestamps to detect changes (avoid no-op writes).
  const { data: prospects, error: pErr } = await supabase
    .from("prospects")
    .select("id, email, last_email_sent_at")
    .not("email", "is", null)

  if (pErr || !prospects) {
    logger.error("[apollo-email-events] recompute prospects fetch failed", { error: pErr?.message })
    return { updated: 0, error: pErr?.message ?? "fetch failed" }
  }

  let updated = 0
  for (const p of prospects as Array<{ id: string; email: string; last_email_sent_at: string | null }>) {
    const target = maxByEmail.get(p.email.toLowerCase())
    if (!target) continue
    if (p.last_email_sent_at === target) continue
    const { error: uErr } = await supabase
      .from("prospects")
      .update({ last_email_sent_at: target } as never)
      .eq("id", p.id)
    if (!uErr) updated++
  }

  logger.info("[apollo-email-events] recompute complete", { updated })
  return { updated, error: null }
}
