"use server"

import { Resend } from "resend"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { updateContactStage, updateAccountStage } from "@/lib/apollo-client"

export type ProspectStatus =
  | "prospect"
  | "contacted"
  | "visitor"
  | "signup"
  | "company"
  | "active"

export type SequenceStatus = "not_started" | "active" | "paused" | "finished"

export type Prospect = {
  id: string
  email: string
  contact_name: string | null
  company_name: string | null
  city: string | null
  source: string
  status: ProspectStatus
  ref_code: string
  apollo_contact_id: string | null
  sequence_status: SequenceStatus
  emails_sent: number
  emails_delivered: number
  emails_opened: number
  emails_clicked: number
  last_email_opened_at: string | null
  last_email_clicked_at: string | null
  user_id: string | null
  company_id: string | null
  project_id: string | null
  last_email_sent_at: string | null
  landing_visited_at: string | null
  signed_up_at: string | null
  company_created_at: string | null
  project_published_at: string | null
  converted_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ProspectEvent = {
  id: string
  prospect_id: string
  event_type: string
  metadata: Record<string, unknown>
  created_at: string
}

export type ProspectFunnel = {
  total: number
  prospect: number
  contacted: number
  visitor: number
  signup: number
  company: number
  publisher: number
  active: number
  total_emails_sent: number
}

type FetchProspectsFilters = {
  status?: ProspectStatus | "all"
  source?: string
  sequence?: SequenceStatus | "all"
  search?: string
  offset?: number
  limit?: number
}

export async function fetchProspects(filters: FetchProspectsFilters = {}) {
  const supabase = createServiceRoleSupabaseClient()
  const { status, source, sequence, search, offset = 0, limit = 50 } = filters

  let query = supabase
    .from("prospects")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && status !== "all") {
    query = query.eq("status", status)
  }

  if (source && source !== "all") {
    query = query.eq("source", source)
  }

  if (sequence && sequence !== "all") {
    query = query.eq("sequence_status", sequence)
  }

  if (search) {
    query = query.or(`email.ilike.%${search}%,company_name.ilike.%${search}%,contact_name.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error("Failed to fetch prospects", error)
    return { prospects: [] as Prospect[], error: error.message }
  }

  return { prospects: (data ?? []) as Prospect[] }
}

const EMPTY_FUNNEL: ProspectFunnel = {
  total: 0, prospect: 0, contacted: 0, visitor: 0,
  signup: 0, company: 0, publisher: 0, active: 0,
  total_emails_sent: 0,
}

export async function fetchFunnel(source?: string) {
  const supabase = createServiceRoleSupabaseClient()

  // Query prospects directly with optional source filter
  let query = supabase.from("prospects").select("status, emails_sent, source")
  if (source && source !== "all") {
    query = query.eq("source", source)
  }

  const { data: allProspects, error } = await query

  if (error) {
    console.error("Failed to fetch funnel", error)
    return { funnel: EMPTY_FUNNEL }
  }

  const funnel: ProspectFunnel = { ...EMPTY_FUNNEL }
  const prospects = (allProspects ?? []) as Array<{ status: string; emails_sent: number; source: string }>

  for (const p of prospects) {
    funnel.total++
    const key = p.status as keyof ProspectFunnel
    if (key in funnel && typeof (funnel as any)[key] === "number") {
      (funnel as any)[key] = ((funnel as any)[key] || 0) + 1
    }
    funnel.total_emails_sent += p.emails_sent || 0
  }

  return { funnel }
}

export async function addProspect(formData: {
  email: string
  contact_name?: string
  company_name?: string
  city?: string
  source?: string
}) {
  const supabase = createServiceRoleSupabaseClient()

  const { data, error } = await supabase
    .from("prospects")
    .insert({
      email: formData.email,
      contact_name: formData.contact_name || null,
      company_name: formData.company_name || null,
      city: formData.city || null,
      source: formData.source || "manual",
      status: "prospect",
    })
    .select()
    .single()

  if (error) {
    console.error("Failed to add prospect", error)
    return { success: false, error: error.message }
  }

  // Log event
  await supabase.from("prospect_events").insert({
    prospect_id: data.id,
    event_type: "created",
    metadata: { source: formData.source || "manual" },
  })

  return { success: true, prospect: data as Prospect }
}

const STATUS_TO_APOLLO_STAGE: Record<string, string> = {
  prospect: "Prospect",
  contacted: "Contacted",
  visitor: "Visitor",
  signup: "Signup",
  company: "Draft",
  active: "Listed",
}

export async function updateProspectStatus(id: string, newStatus: ProspectStatus) {
  const supabase = createServiceRoleSupabaseClient()

  const timestampField = {
    contacted: "last_email_sent_at",
    visitor: "landing_visited_at",
    signup: "signed_up_at",
    company: "company_created_at",
    active: "converted_at",
  } as Record<string, string>

  const updateData: Record<string, unknown> = { status: newStatus }
  const tsField = timestampField[newStatus]
  if (tsField) {
    updateData[tsField] = new Date().toISOString()
  }

  const { error } = await supabase
    .from("prospects")
    .update(updateData)
    .eq("id", id)

  if (error) {
    console.error("Failed to update prospect status", error)
    return { success: false, error: error.message }
  }

  // Log event
  await supabase.from("prospect_events").insert({
    prospect_id: id,
    event_type: "status_changed",
    metadata: { new_status: newStatus },
  })

  // Sync Apollo contact stage
  const stageName = STATUS_TO_APOLLO_STAGE[newStatus]
  if (stageName) {
    const { data: prospect } = await supabase
      .from("prospects")
      .select("apollo_contact_id")
      .eq("id", id)
      .single()
    const apolloId = (prospect as any)?.apollo_contact_id
    if (apolloId) {
      try {
        await Promise.all([
          updateContactStage(apolloId, stageName),
          updateAccountStage(apolloId, stageName),
        ])
      } catch (err) {
        console.error("Failed to sync Apollo stage", err)
      }
    }
  }

  return { success: true }
}

export async function fetchProspectEvents(prospectId: string) {
  const supabase = createServiceRoleSupabaseClient()

  const { data, error } = await supabase
    .from("prospect_events")
    .select("*")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch prospect events", error)
    return { events: [] as ProspectEvent[], error: error.message }
  }

  return { events: (data ?? []) as ProspectEvent[] }
}

export async function deleteProspect(id: string) {
  const supabase = createServiceRoleSupabaseClient()

  const { error } = await supabase
    .from("prospects")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("Failed to delete prospect", error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

// ─── Arco & Invite prospect sync ────────────────────────────────────────────

/**
 * Sync prospected companies (source: arco) and invited companies (source: invites)
 * into the prospects table. Called on page load.
 */
export async function syncPlatformProspects() {
  const supabase = createServiceRoleSupabaseClient()

  // 1. Sync prospected companies (status = 'prospected') → source 'arco'
  const { data: prospectedCompanies } = await supabase
    .from("companies")
    .select("id, name, email, city, slug")
    .eq("status", "prospected" as any)
    .is("owner_id", null)

  for (const company of prospectedCompanies ?? []) {
    const { data: existing } = await supabase
      .from("prospects")
      .select("id")
      .eq("company_id", company.id)
      .eq("source", "arco")
      .maybeSingle()

    if (!existing) {
      const { count } = await supabase
        .from("company_outreach" as any)
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)

      const emailsSent = count ?? 0

      await supabase.from("prospects").insert({
        email: company.email ?? "",
        contact_name: null,
        company_name: company.name,
        city: company.city ?? null,
        source: "arco",
        status: "prospect",
        sequence_status: emailsSent > 0 ? "finished" : "not_started",
        emails_sent: emailsSent,
        emails_delivered: emailsSent,
        company_id: company.id,
        ref_code: company.slug ?? company.id,
      })
    }
  }

  // 2. Sync invited companies (from project_professionals, not project owner, no company owner)
  const { data: invitedPros } = await supabase
    .from("project_professionals")
    .select("company_id, invited_email, status, companies(id, name, email, city, slug, owner_id)")
    .eq("is_project_owner", false)
    .not("company_id", "is", null)

  const invitedByCompany = new Map<string, { email: string; companyName: string; city: string | null; slug: string | null; inviteCount: number; hasSentEmail: boolean }>()

  for (const pp of invitedPros ?? []) {
    const company = (pp as any).companies
    if (!company || company.owner_id) continue
    const key = company.id as string
    const prev = invitedByCompany.get(key)
    const isSent = pp.status !== "invited" // if status moved past invited, email was sent
    if (prev) {
      prev.inviteCount++
      if (isSent) prev.hasSentEmail = true
    } else {
      invitedByCompany.set(key, {
        email: pp.invited_email ?? company.email ?? "",
        companyName: company.name,
        city: company.city ?? null,
        slug: company.slug ?? null,
        inviteCount: 1,
        hasSentEmail: isSent,
      })
    }
  }

  for (const [companyId, info] of invitedByCompany) {
    if (!info.email) continue
    const { data: existing } = await supabase
      .from("prospects")
      .select("id")
      .eq("company_id", companyId)
      .eq("source", "invites")
      .maybeSingle()

    if (!existing) {
      await supabase.from("prospects").insert({
        email: info.email,
        contact_name: null,
        company_name: info.companyName,
        city: info.city,
        source: "invites",
        status: "prospect",
        sequence_status: info.hasSentEmail ? "finished" : "not_started",
        emails_sent: info.hasSentEmail ? info.inviteCount : 0,
        emails_delivered: info.hasSentEmail ? info.inviteCount : 0,
        company_id: companyId,
        ref_code: info.slug ?? companyId,
      })
    }
  }

  // 3. Remove invited prospects where company no longer has any invites
  const { data: inviteProspects } = await supabase
    .from("prospects")
    .select("id, company_id")
    .eq("source", "invites")

  for (const p of inviteProspects ?? []) {
    if (!p.company_id) continue
    const { count } = await supabase
      .from("project_professionals")
      .select("id", { count: "exact", head: true })
      .eq("company_id", p.company_id)
      .eq("is_project_owner", false)

    if (!count || count === 0) {
      await supabase.from("prospects").delete().eq("id", p.id)
    }
  }
}

/**
 * Start prospect sequence: send the prospect email and update status
 */
export async function startProspectSequence(prospectId: string) {
  const supabase = createServiceRoleSupabaseClient()

  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, email, company_id, source, emails_sent")
    .eq("id", prospectId)
    .single()

  if (!prospect) return { success: false, error: "Prospect not found" }
  if (!prospect.company_id) return { success: false, error: "No linked company" }

  // Set sequence to active
  await supabase.from("prospects").update({ sequence_status: "active" }).eq("id", prospectId)

  // Send the prospect email
  const { sendProspectEmailAction } = await import("@/app/admin/professionals/actions")
  const result = await sendProspectEmailAction({
    companyId: prospect.company_id,
    emailTo: prospect.email,
  })

  if (!result.success) {
    await supabase.from("prospects").update({ sequence_status: "not_started" }).eq("id", prospectId)
    return { success: false, error: result.error }
  }

  // Update: sequence active (follow-up emails pending), increment sent count
  await supabase.from("prospects").update({
    sequence_status: "active",
    emails_sent: (prospect.emails_sent ?? 0) + 1,
    emails_delivered: (prospect.emails_delivered ?? 0) + 1,
    last_email_sent_at: new Date().toISOString(),
    status: "contacted",
  }).eq("id", prospectId)

  await supabase.from("prospect_events").insert({
    prospect_id: prospectId,
    event_type: "email_sent",
    metadata: { template: "prospect_intro", email: prospect.email },
  })

  return { success: true }
}

/**
 * Update prospect email and sync to company record
 */
export async function updateProspectEmail(prospectId: string, newEmail: string) {
  const supabase = createServiceRoleSupabaseClient()

  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, company_id, source")
    .eq("id", prospectId)
    .single()

  if (!prospect) return { success: false, error: "Prospect not found" }

  const { error: updateError } = await supabase.from("prospects").update({ email: newEmail }).eq("id", prospectId)

  if (updateError) {
    console.error("Failed to update prospect email", updateError)
    return { success: false, error: updateError.message || "Failed to update email" }
  }

  // Sync to companies table for Arco source
  if (prospect.source === "arco" && prospect.company_id) {
    await supabase.from("companies").update({ email: newEmail }).eq("id", prospect.company_id)
  }

  return { success: true }
}

/**
 * Pause a prospect sequence
 */
export async function pauseProspectSequence(prospectId: string) {
  const supabase = createServiceRoleSupabaseClient()
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, sequence_status")
    .eq("id", prospectId)
    .single()

  if (!prospect) return { success: false, error: "Prospect not found" }
  if (prospect.sequence_status !== "active" && prospect.sequence_status !== "finished") {
    return { success: false, error: "Sequence is not active" }
  }

  await supabase.from("prospects").update({ sequence_status: "paused" }).eq("id", prospectId)
  return { success: true }
}

/**
 * Resume a paused prospect sequence
 */
export async function resumeProspectSequence(prospectId: string) {
  const supabase = createServiceRoleSupabaseClient()
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, sequence_status")
    .eq("id", prospectId)
    .single()

  if (!prospect) return { success: false, error: "Prospect not found" }
  if (prospect.sequence_status !== "paused") {
    return { success: false, error: "Sequence is not paused" }
  }

  await supabase.from("prospects").update({ sequence_status: "finished" }).eq("id", prospectId)
  return { success: true }
}

/**
 * Restart a prospect sequence — resend the email
 */
export async function restartProspectSequence(prospectId: string) {
  const supabase = createServiceRoleSupabaseClient()
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, email, company_id, source, emails_sent, sequence_status")
    .eq("id", prospectId)
    .single()

  if (!prospect) return { success: false, error: "Prospect not found" }
  if (!prospect.company_id) return { success: false, error: "No linked company" }
  if (prospect.source !== "arco") return { success: false, error: "Restart only available for Arco prospects" }

  // Set sequence to active
  await supabase.from("prospects").update({ sequence_status: "active" }).eq("id", prospectId)

  // Send the prospect email
  const { sendProspectEmailAction } = await import("@/app/admin/professionals/actions")
  const result = await sendProspectEmailAction({
    companyId: prospect.company_id,
    emailTo: prospect.email,
  })

  if (!result.success) {
    await supabase.from("prospects").update({ sequence_status: prospect.sequence_status ?? "not_started" }).eq("id", prospectId)
    return { success: false, error: result.error }
  }

  await supabase.from("prospects").update({
    sequence_status: "active",
    emails_sent: (prospect.emails_sent ?? 0) + 1,
    emails_delivered: (prospect.emails_delivered ?? 0) + 1,
    last_email_sent_at: new Date().toISOString(),
  }).eq("id", prospectId)

  await supabase.from("prospect_events").insert({
    prospect_id: prospectId,
    event_type: "email_resent",
    metadata: { template: "prospect_intro", email: prospect.email },
  })

  return { success: true }
}

/**
 * Sync email open/click stats from Resend API to prospects table.
 * Called when the Sales page loads to backfill webhook gaps.
 */
export async function syncResendEmailStats() {
  if (!process.env.RESEND_API_KEY) return { synced: 0 }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data, error } = await resend.emails.list()
    if (error || !data?.data) return { synced: 0 }

    // Count per recipient: how many emails were sent, delivered, opened, clicked
    const recipientStats = new Map<string, { sent: number; delivered: number; opened: number; clicked: number }>()
    for (const email of data.data as any[]) {
      const event = email.last_event ?? "sent"
      const recipients: string[] = Array.isArray(email.to) ? email.to : [email.to]
      for (const to of recipients) {
        if (!to) continue
        const addr = to.toLowerCase().trim()
        const existing = recipientStats.get(addr) ?? { sent: 0, delivered: 0, opened: 0, clicked: 0 }
        existing.sent++
        if (event === "delivered" || event === "opened" || event === "clicked") existing.delivered++
        if (event === "opened" || event === "clicked") existing.opened++
        if (event === "clicked") existing.clicked++
        recipientStats.set(addr, existing)
      }
    }

    const supabase = createServiceRoleSupabaseClient()
    let synced = 0

    const allEmails = Array.from(recipientStats.keys())
    if (allEmails.length === 0) return { synced: 0 }

    const { data: prospects } = await supabase
      .from("prospects")
      .select("id, email, emails_sent, emails_delivered, emails_opened, emails_clicked")
      .in("email", allEmails)

    for (const prospect of prospects ?? []) {
      const stats = recipientStats.get(prospect.email.toLowerCase().trim())
      if (!stats) continue

      const updates: Record<string, unknown> = {}
      if (stats.sent > (prospect.emails_sent ?? 0)) updates.emails_sent = stats.sent
      if (stats.delivered > (prospect.emails_delivered ?? 0)) updates.emails_delivered = stats.delivered
      if (stats.opened > (prospect.emails_opened ?? 0)) updates.emails_opened = stats.opened
      if (stats.clicked > (prospect.emails_clicked ?? 0)) updates.emails_clicked = stats.clicked

      if (Object.keys(updates).length > 0) {
        await supabase.from("prospects").update(updates).eq("id", prospect.id)
        synced++
      }
    }

    return { synced }
  } catch {
    return { synced: 0 }
  }
}
