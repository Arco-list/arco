import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { syncApolloList, syncApolloActivity } from "@/lib/apollo-sync"

export async function POST(request: NextRequest) {
  // Auth check — admin only
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check admin role from profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", user.id)
    .single()

  if (!profile || !isAdminUser(profile.user_types, profile.admin_role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const action = body.action as string

  // Service-role client used for sync_runs writes (admin RLS-bypass) and
  // for the actual Apollo helpers (which already create their own).
  const adminSupabase = createServiceRoleSupabaseClient()

  // Open a sync_runs row before kicking off, patch it on completion. Lets
  // the Apollo Sync popup surface manual + cron run history side-by-side.
  async function recordRun(kind: "list" | "activity", listId: string | null, fn: () => Promise<any>) {
    const { data: runRow } = await adminSupabase
      .from("apollo_sync_runs")
      .insert({
        kind,
        triggered_by: "manual",
        started_at: new Date().toISOString(),
        list_id: listId,
      } as any)
      .select("id")
      .single()
    const runId = (runRow as any)?.id as string | undefined

    try {
      const result = await fn()
      if (runId) {
        await adminSupabase
          .from("apollo_sync_runs")
          .update({
            finished_at: new Date().toISOString(),
            synced_count: result.synced ?? result.updated ?? null,
            total_count: result.total ?? null,
            error_count: result.errorCount ?? 0,
            last_error: result.lastError ?? null,
          } as any)
          .eq("id", runId)
      }
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (runId) {
        await adminSupabase
          .from("apollo_sync_runs")
          .update({
            finished_at: new Date().toISOString(),
            error_count: 1,
            last_error: message,
          } as any)
          .eq("id", runId)
      }
      throw err
    }
  }

  if (action === "sync_list") {
    const listId = body.list_id as string
    if (!listId) {
      return NextResponse.json({ error: "list_id is required" }, { status: 400 })
    }
    const result = await recordRun("list", listId, () => syncApolloList(listId))
    return NextResponse.json(result)
  }

  if (action === "sync_activity") {
    const result = await recordRun("activity", null, () => syncApolloActivity())
    return NextResponse.json(result)
  }

  if (action === "debug_contact") {
    const contactId = body.contact_id as string
    if (!contactId) {
      return NextResponse.json({ error: "contact_id is required" }, { status: 400 })
    }
    try {
      const res = await fetch(`https://api.apollo.io/api/v1/contacts/${contactId}`, {
        headers: { "Content-Type": "application/json", "X-Api-Key": process.env.APOLLO_API_KEY! },
      })
      const data = await res.json()
      // Return top-level keys and the contact's keys (not full data to avoid leaking PII)
      const contact = data.contact ?? {}
      // Also fetch the emailer campaign details if available
      let campaignDetails = null
      const campaignStatuses = contact.contact_campaign_statuses ?? []
      if (campaignStatuses.length > 0) {
        const campaignId = campaignStatuses[0].emailer_campaign_id
        try {
          const campRes = await fetch(`https://api.apollo.io/api/v1/emailer_campaigns/${campaignId}`, {
            headers: { "Content-Type": "application/json", "X-Api-Key": process.env.APOLLO_API_KEY! },
          })
          const campData = await campRes.json()
          const camp = campData.emailer_campaign ?? {}
          campaignDetails = {
            keys: Object.keys(camp),
            emails_sent: camp.emails_sent ?? null,
            emails_delivered: camp.emails_delivered ?? null,
            emails_bounced: camp.emails_bounced ?? null,
            emails_opened: camp.emails_opened ?? null,
            unique_delivered: camp.unique_delivered ?? null,
            unique_bounced: camp.unique_bounced ?? null,
            delivery_rate: camp.delivery_rate ?? null,
          }
        } catch {}
      }

      return NextResponse.json({
        topKeys: Object.keys(data),
        contactKeys: Object.keys(contact),
        emailer_campaign_ids: contact.emailer_campaign_ids ?? null,
        contact_campaign_statuses: contact.contact_campaign_statuses ?? null,
        contact_stage_id: contact.contact_stage_id ?? null,
        email_status: contact.email_status ?? null,
        email_unsubscribed: contact.email_unsubscribed ?? null,
        campaignDetails,
      })
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Unknown action. Use 'sync_list', 'sync_activity', or 'debug_contact'" }, { status: 400 })
}
