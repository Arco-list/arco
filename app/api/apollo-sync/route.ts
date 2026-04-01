import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
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

  if (action === "sync_list") {
    const listId = body.list_id as string
    if (!listId) {
      return NextResponse.json({ error: "list_id is required" }, { status: 400 })
    }
    const result = await syncApolloList(listId)
    return NextResponse.json(result)
  }

  if (action === "sync_activity") {
    const result = await syncApolloActivity()
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
