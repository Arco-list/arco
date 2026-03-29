import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
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

interface ApolloEmailActivity {
  emailer_campaign_id?: string
  email_sent_at?: string
  email_opened_at?: string
  email_clicked_at?: string
  email_bounced_at?: string
  email_unsubscribed_at?: string
}

// ─── Sync contacts from an Apollo list ──────────────────────────────────────

export async function syncApolloList(listId: string) {
  const supabase = createServiceRoleSupabaseClient()
  let page = 1
  let totalSynced = 0
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
          { onConflict: "email" }
        )

      if (error) {
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

  logger.info("Apollo list sync complete", { listId, totalSynced })
  return { synced: totalSynced }
}

// ─── Sync email activity for all active prospects ───────────────────────────

export async function syncApolloActivity() {
  const supabase = createServiceRoleSupabaseClient()

  // Get all prospects with an Apollo contact ID that aren't terminal
  const { data: prospects, error } = await supabase
    .from("prospects")
    .select("id, email, apollo_contact_id, status, emails_sent, emails_opened, emails_clicked")
    .not("apollo_contact_id", "is", null)
    .not("status", "in", '("unsubscribed","bounced","converted","project_published")')
    .order("updated_at", { ascending: true })
    .limit(100) // Process in batches to avoid rate limits

  if (error || !prospects) {
    logger.error("Failed to fetch prospects for activity sync", { error })
    return { updated: 0 }
  }

  let updated = 0

  for (const prospect of prospects as any[]) {
    try {
      // Fetch contact details from Apollo (includes email activity)
      const data = await apolloRequest(`/contacts/${prospect.apollo_contact_id}`)
      const contact = data.contact as ApolloContact & ApolloEmailActivity & {
        emailer_campaigns?: Array<{
          id: string
          emails_sent?: number
          emails_opened?: number
          emails_clicked?: number
          email_bounced?: boolean
          unsubscribed?: boolean
        }>
      }

      if (!contact) continue

      // Aggregate email stats from campaigns
      const campaigns = contact.emailer_campaigns ?? []
      let totalSent = 0
      let totalOpened = 0
      let totalClicked = 0
      let isBounced = false
      let isUnsubscribed = false
      let sequenceId: string | null = null

      for (const campaign of campaigns) {
        totalSent += campaign.emails_sent ?? 0
        totalOpened += campaign.emails_opened ?? 0
        totalClicked += campaign.emails_clicked ?? 0
        if (campaign.email_bounced) isBounced = true
        if (campaign.unsubscribed) isUnsubscribed = true
        if (!sequenceId && campaign.id) sequenceId = campaign.id
      }

      // Determine new status based on activity
      const STATUS_ORDER = [
        "imported", "sequence_active", "email_opened", "email_clicked",
        "landing_visited", "signed_up", "company_created", "project_started",
        "project_published", "converted",
      ]
      const currentIdx = STATUS_ORDER.indexOf(prospect.status)

      let newStatus = prospect.status
      if (isUnsubscribed) {
        newStatus = "unsubscribed"
      } else if (isBounced) {
        newStatus = "bounced"
      } else if (totalClicked > 0 && currentIdx < STATUS_ORDER.indexOf("email_clicked")) {
        newStatus = "email_clicked"
      } else if (totalOpened > 0 && currentIdx < STATUS_ORDER.indexOf("email_opened")) {
        newStatus = "email_opened"
      } else if (totalSent > 0 && currentIdx < STATUS_ORDER.indexOf("sequence_active")) {
        newStatus = "sequence_active"
      }

      // Build update
      const updates: Record<string, any> = {
        emails_sent: totalSent,
        emails_opened: totalOpened,
        emails_clicked: totalClicked,
        status: newStatus,
      }

      if (sequenceId) updates.apollo_sequence_id = sequenceId
      if (totalSent > 0) updates.last_email_sent_at = new Date().toISOString()
      if (totalOpened > 0) updates.last_email_opened_at = new Date().toISOString()
      if (totalClicked > 0) updates.last_email_clicked_at = new Date().toISOString()
      if (isUnsubscribed) updates.unsubscribed_at = new Date().toISOString()

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
            metadata: { emails_sent: totalSent, emails_opened: totalOpened, emails_clicked: totalClicked },
          })
        }
        updated++
      }

      // Small delay to respect Apollo rate limits (10 req/min on free plan)
      await new Promise((r) => setTimeout(r, 700))
    } catch (err) {
      logger.error("Failed to sync activity for prospect", { id: prospect.id, error: err })
    }
  }

  logger.info("Apollo activity sync complete", { updated, total: prospects.length })
  return { updated, total: prospects.length }
}
