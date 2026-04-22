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

/**
 * Resolved "contact" for the Sales table row — the person we're actually
 * talking to at this funnel stage. Mirrors the Owner cell on admin/companies
 * once the prospect has progressed to Draft/Listed.
 *
 *   source = "outreach"  → prospects.email / contact_name (Prospect, Contacted, Visitor)
 *   source = "signup"    → prospects.user_id → profiles + auth email (Signup)
 *   source = "owner"     → companies.owner_id → profiles + auth email (Draft, Listed;
 *                           overrides signup when a different user claimed the company)
 */
export type ProspectResolvedContact = {
  source: "outreach" | "signup" | "owner"
  name: string | null
  email: string | null
  avatarUrl: string | null
  userId: string | null
}

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
  resolvedContact: ProspectResolvedContact
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

  const rows = (data ?? []) as Omit<Prospect, "resolvedContact">[]
  const prospects = await attachResolvedContacts(supabase, rows)
  return { prospects }
}

/**
 * Resolve the Contact cell per prospect based on its funnel stage.
 * Batches profile + auth-email lookups so one admin/sales page render
 * costs O(unique users + unique company owners), not O(rows × 2).
 */
async function attachResolvedContacts(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  rows: Omit<Prospect, "resolvedContact">[],
): Promise<Prospect[]> {
  if (rows.length === 0) return []

  // Stage 1: fetch companies so we know each prospect's company.owner_id
  const companyIds = Array.from(new Set(rows.map((r) => r.company_id).filter((id): id is string => Boolean(id))))
  const companyOwnerById = new Map<string, string | null>()
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from("companies")
      .select("id, owner_id")
      .in("id", companyIds)
    for (const c of companies ?? []) companyOwnerById.set(c.id, c.owner_id ?? null)
  }

  // Stage 2: collect every user id we need a profile for — signup users
  // and company owners.
  const userIds = new Set<string>()
  for (const r of rows) {
    if (r.user_id) userIds.add(r.user_id)
    const ownerId = r.company_id ? companyOwnerById.get(r.company_id) : null
    if (ownerId) userIds.add(ownerId)
  }

  // Stage 3: one batched profile query
  const profileById = new Map<string, { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }>()
  if (userIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", Array.from(userIds))
    for (const p of profiles ?? []) profileById.set(p.id, p)
  }

  // Stage 4: auth emails (one call per unique id; mirrors admin/companies)
  const emailByUserId = new Map<string, string>()
  for (const uid of userIds) {
    const { data } = await supabase.auth.admin.getUserById(uid)
    if (data?.user?.email) emailByUserId.set(uid, data.user.email)
  }

  const nameFromProfile = (
    p: { first_name: string | null; last_name: string | null } | undefined | null,
  ): string | null => {
    if (!p) return null
    return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || null
  }

  return rows.map((r): Prospect => {
    const ownerId = r.company_id ? companyOwnerById.get(r.company_id) ?? null : null
    const ownerProfile = ownerId ? profileById.get(ownerId) : null
    const signupProfile = r.user_id ? profileById.get(r.user_id) : null

    let resolved: ProspectResolvedContact

    if ((r.status === "company" || r.status === "active") && ownerProfile) {
      resolved = {
        source: "owner",
        name: nameFromProfile(ownerProfile),
        email: (ownerId && emailByUserId.get(ownerId)) ?? null,
        avatarUrl: ownerProfile.avatar_url ?? null,
        userId: ownerId,
      }
    } else if (r.status === "signup" && signupProfile) {
      resolved = {
        source: "signup",
        name: nameFromProfile(signupProfile),
        email: (r.user_id && emailByUserId.get(r.user_id)) ?? null,
        avatarUrl: signupProfile.avatar_url ?? null,
        userId: r.user_id,
      }
    } else {
      // Prospect, Contacted, Visitor — or a stage where the preferred
      // profile is missing. Fall back to the outreach contact fields,
      // matching what's stored on the linked companies row.
      resolved = {
        source: "outreach",
        name: r.contact_name,
        email: r.email,
        avatarUrl: null,
        userId: null,
      }
    }

    return { ...r, resolvedContact: resolved }
  })
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

  return { success: true, warning: result.warning }
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
 * Pause a prospect sequence.
 *
 * PR 5 of the drip pipeline: this used to only flip prospects.sequence_status
 * to 'paused' without touching email_drip_queue, which meant pausing in the
 * UI didn't actually stop the next drip from going out. Now also cancels
 * any pending drip rows for the prospect's company so a paused sequence
 * is actually paused. Cancellation is non-fatal — pausing the prospect
 * row succeeds even if no drip rows match (e.g. for prospects whose
 * intro went out before PR 3 enqueued any followups).
 */
export async function pauseProspectSequence(prospectId: string) {
  const supabase = createServiceRoleSupabaseClient()
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, company_id, sequence_status")
    .eq("id", prospectId)
    .single()

  if (!prospect) return { success: false, error: "Prospect not found" }
  if (prospect.sequence_status !== "active" && prospect.sequence_status !== "finished") {
    return { success: false, error: "Sequence is not active" }
  }

  await supabase.from("prospects").update({ sequence_status: "paused" }).eq("id", prospectId)

  if (prospect.company_id) {
    try {
      const { cancelPendingDripRows } = await import("@/lib/drip-queue")
      await cancelPendingDripRows(supabase, {
        companyId: prospect.company_id,
        reason: "paused",
      })
    } catch (err) {
      console.error("[pauseProspectSequence] Failed to cancel pending drip rows", err)
    }
  }

  return { success: true }
}

/**
 * PR 5 of the drip pipeline: load the full sequence status for a prospect
 * for the admin Sales view's details panel. Returns the intro send (if any)
 * from company_outreach plus the followup + final rows from email_drip_queue.
 *
 * Returned shape is intentionally flat and UI-friendly — the caller renders
 * each step as a row with timestamp + status badge.
 */
export type ProspectSequenceStep = {
  template: "prospect-intro" | "prospect-followup" | "prospect-final"
  label: string
  /**
   *   sent      — email_drip_queue.sent_at is set (cron sent it)
   *   queued    — pending row: send_at in future, not yet sent/cancelled
   *   paused    — cancelled with reason 'paused'; resume will re-enqueue
   *   finished  — cancelled with reason 'status_change' (prospect converted)
   *               or 'manual' (admin clicked Finish sequence)
   *   cancelled — cancelled for any other reason (bounce, complaint, etc.)
   *   failed    — cron hit the retry cap
   *   missing   — no row in email_drip_queue for this (company, template)
   *               (only expected on rows scraped before migration 134)
   */
  status: "sent" | "queued" | "paused" | "finished" | "cancelled" | "failed" | "missing"
  timestamp: string | null
  cancelledReason: string | null
  attemptCount: number
  lastError: string | null
}

export async function getProspectSequence(prospectId: string): Promise<{
  success: boolean
  steps?: ProspectSequenceStep[]
  error?: string
}> {
  const supabase = createServiceRoleSupabaseClient()

  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, company_id, email")
    .eq("id", prospectId)
    .maybeSingle()

  if (!prospect) return { success: false, error: "Prospect not found" }
  if (!prospect.company_id) {
    // Can't have a sequence without a linked company. Return an empty
    // result so the UI can show "no sequence" gracefully.
    return { success: true, steps: [] }
  }

  // Intro: read from company_outreach (intro is sent direct via Resend, not
  // via email_drip_queue, so it's the only template that ever lands here).
  const { data: outreachRows } = await supabase
    .from("company_outreach" as never)
    .select("template, sent_at, opened_at, clicked_at")
    .eq("company_id", prospect.company_id)
    .eq("template", "prospect_intro")
    .order("sent_at", { ascending: false })
    .limit(1)

  // Followup + Final: read from email_drip_queue. Most recent matching row wins.
  const { data: queueRows } = await supabase
    .from("email_drip_queue")
    .select("template, send_at, sent_at, cancelled_at, cancelled_reason, attempt_count, last_error")
    .eq("company_id", prospect.company_id)
    .in("template", ["prospect-followup", "prospect-final"])
    .order("created_at", { ascending: false })

  // Build a map: template → most recent row (we sorted desc above)
  const queueByTemplate = new Map<string, NonNullable<typeof queueRows>[number]>()
  for (const row of queueRows ?? []) {
    if (!queueByTemplate.has(row.template)) {
      queueByTemplate.set(row.template, row)
    }
  }

  const introRow = (outreachRows ?? [])[0] as
    | { template: string; sent_at: string | null; opened_at: string | null; clicked_at: string | null }
    | undefined
  const followupRow = queueByTemplate.get("prospect-followup")
  const finalRow = queueByTemplate.get("prospect-final")

  const queueRowToStep = (
    template: "prospect-followup" | "prospect-final",
    label: string,
    row: NonNullable<typeof queueRows>[number] | undefined,
  ): ProspectSequenceStep => {
    if (!row) {
      return {
        template,
        label,
        status: "missing",
        timestamp: null,
        cancelledReason: null,
        attemptCount: 0,
        lastError: null,
      }
    }
    let status: ProspectSequenceStep["status"]
    if (row.sent_at) {
      status = "sent"
    } else if (row.cancelled_at) {
      // Distinguish pause (resumable) from finish (terminal) from other
      // cancellations (bounce, complaint, max_attempts) so the popup can
      // render the right badge.
      const reason = row.cancelled_reason
      if (reason === "paused") status = "paused"
      else if (reason === "status_change" || reason === "manual") status = "finished"
      else status = "cancelled"
    } else if (row.last_error && row.attempt_count >= 1) {
      status = "failed"
    } else {
      status = "queued"
    }
    return {
      template,
      label,
      status,
      timestamp: row.sent_at ?? row.cancelled_at ?? row.send_at ?? null,
      cancelledReason: row.cancelled_reason ?? null,
      attemptCount: row.attempt_count ?? 0,
      lastError: row.last_error ?? null,
    }
  }

  const steps: ProspectSequenceStep[] = [
    {
      template: "prospect-intro",
      label: "Intro",
      status: introRow?.sent_at ? "sent" : "missing",
      timestamp: introRow?.sent_at ?? null,
      cancelledReason: null,
      attemptCount: 0,
      lastError: null,
    },
    queueRowToStep("prospect-followup", "Follow-up", followupRow),
    queueRowToStep("prospect-final", "Final", finalRow),
  ]

  return { success: true, steps }
}

/**
 * Resume a paused prospect sequence.
 *
 * Pause cancelled the pending drip rows with reason 'paused'. Resume
 * re-enqueues fresh rows for each step that hasn't been sent yet, with
 * new send_at timestamps (now + 3 business days for the follow-up,
 * now + 7 for the final). Variables are copied from the last cancelled
 * row so the email renders identically.
 *
 * Steps that were already sent (e.g. sequence was paused AFTER the
 * follow-up fired) are skipped — we don't re-send.
 */
export async function resumeProspectSequence(prospectId: string) {
  const supabase = createServiceRoleSupabaseClient()
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, company_id, email, sequence_status")
    .eq("id", prospectId)
    .single()

  if (!prospect) return { success: false, error: "Prospect not found" }
  if (prospect.sequence_status !== "paused") {
    return { success: false, error: "Sequence is not paused" }
  }

  if (prospect.company_id) {
    try {
      const { nextBusinessSlot } = await import("@/lib/date-utils")
      const stepConfig: Array<{
        template: "prospect-followup" | "prospect-final"
        step: number
        sendAt: string
      }> = [
        { template: "prospect-followup", step: 1, sendAt: nextBusinessSlot(3).toISOString() },
        { template: "prospect-final", step: 2, sendAt: nextBusinessSlot(7).toISOString() },
      ]

      for (const { template, step, sendAt } of stepConfig) {
        // Most recent row for (company, template) — carries the variables
        // payload and tells us whether the step already went out.
        const { data: lastRow } = await supabase
          .from("email_drip_queue")
          .select("variables, sent_at, email")
          .eq("company_id", prospect.company_id)
          .eq("template", template)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (lastRow?.sent_at) continue

        const { error: insertError } = await supabase
          .from("email_drip_queue")
          .insert({
            company_id: prospect.company_id,
            email: lastRow?.email ?? prospect.email,
            template,
            sequence: "prospect-outreach",
            step,
            variables: (lastRow?.variables as Record<string, unknown> | null) ?? {},
            send_at: sendAt,
          } as never)

        if (insertError && (insertError as { code?: string }).code !== "23505") {
          console.error("[resumeProspectSequence] Failed to re-enqueue", template, insertError)
        }
      }
    } catch (err) {
      console.error("[resumeProspectSequence] Re-enqueue loop threw", err)
    }
  }

  await supabase.from("prospects").update({ sequence_status: "active" }).eq("id", prospectId)
  await supabase.from("prospect_events").insert({
    prospect_id: prospectId,
    event_type: "sequence_resumed",
    metadata: {},
  })
  return { success: true }
}

/**
 * Finish a prospect sequence manually — admin clicked "Finish sequence"
 * in the dropdown. Cancels any pending drip rows (reason: manual) and
 * flips the prospect row to sequence_status 'finished'. Does not reopen
 * — restart the sequence if you need a new cadence.
 */
export async function finishProspectSequence(prospectId: string) {
  const supabase = createServiceRoleSupabaseClient()
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, company_id, sequence_status")
    .eq("id", prospectId)
    .single()

  if (!prospect) return { success: false, error: "Prospect not found" }
  if (prospect.sequence_status === "finished") {
    return { success: false, error: "Sequence is already finished" }
  }

  if (prospect.company_id) {
    try {
      const { cancelPendingDripRows } = await import("@/lib/drip-queue")
      await cancelPendingDripRows(supabase, {
        companyId: prospect.company_id,
        reason: "manual",
      })
    } catch (err) {
      console.error("[finishProspectSequence] Failed to cancel pending drip rows", err)
    }
  }

  await supabase.from("prospects").update({ sequence_status: "finished" }).eq("id", prospectId)
  await supabase.from("prospect_events").insert({
    prospect_id: prospectId,
    event_type: "sequence_finished",
    metadata: { trigger: "admin_manual" },
  })
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

  return { success: true, warning: result.warning }
}

/**
 * Sync email open/click stats from Resend API to prospects table.
 * Called in the background when the Sales page loads to backfill
 * webhook gaps. Throttled to run at most once per hour — the Resend
 * webhook handles real-time updates, this is just a safety net.
 */
export async function syncResendEmailStats() {
  if (!process.env.RESEND_API_KEY) return { synced: 0 }

  // Throttle: only sync if last sync was more than 1 hour ago
  try {
    const supabaseCheck = createServiceRoleSupabaseClient()
    const { data: lastSync } = await supabaseCheck
      .from("email_stats_cache" as any)
      .select("cached_at")
      .eq("template_id", "_prospect_sync")
      .maybeSingle()

    if (lastSync?.cached_at) {
      const elapsed = Date.now() - new Date(lastSync.cached_at).getTime()
      if (elapsed < 60 * 60 * 1000) return { synced: 0 }
    }
  } catch { /* non-fatal — proceed with sync */ }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    // Paginate through Resend emails (up to 500) to avoid missing
    // follow-up/final emails that fall beyond the default 20-row page.
    const allEmails: any[] = []
    let after: string | undefined
    for (let page = 0; page < 5; page++) {
      const opts: { limit: number; after?: string } = { limit: 100 }
      if (after) opts.after = after
      const { data, error } = await resend.emails.list(opts)
      if (error || !data) break
      const rows = (data as any)?.data ?? []
      if (rows.length === 0) break
      allEmails.push(...rows)
      if (!(data as any)?.has_more) break
      const lastId = rows[rows.length - 1]?.id
      if (!lastId) break
      after = lastId
    }

    if (allEmails.length === 0) return { synced: 0 }

    // Count per recipient: how many emails were sent, delivered, opened, clicked
    const recipientStats = new Map<string, { sent: number; delivered: number; opened: number; clicked: number }>()
    for (const email of allEmails) {
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

    const recipientAddresses = Array.from(recipientStats.keys())
    if (recipientAddresses.length === 0) return { synced: 0 }

    const { data: prospects } = await supabase
      .from("prospects")
      .select("id, email, emails_sent, emails_delivered, emails_opened, emails_clicked")
      .in("email", recipientAddresses)

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

    // Record sync timestamp so we don't re-sync within the hour
    await supabase
      .from("email_stats_cache" as any)
      .upsert({ template_id: "_prospect_sync", cached_at: new Date().toISOString(), sends: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 }, { onConflict: "template_id" })

    return { synced }
  } catch {
    return { synced: 0 }
  }
}
