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
  // Order by created_at DESC so the first row per company is the most recent
  // invite — we carry its project_id onto the prospect so startProspectSequence
  // has context for the invite email.
  const { data: invitedPros } = await supabase
    .from("project_professionals")
    .select("company_id, project_id, invited_email, status, created_at, companies(id, name, email, city, slug, owner_id)")
    .eq("is_project_owner", false)
    .not("company_id", "is", null)
    .order("created_at", { ascending: false })

  const invitedByCompany = new Map<string, { email: string; companyName: string; city: string | null; slug: string | null; inviteCount: number; hasSentEmail: boolean; latestProjectId: string | null }>()

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
        latestProjectId: pp.project_id ?? null,
      })
    }
  }

  for (const [companyId, info] of invitedByCompany) {
    if (!info.email) continue
    const { data: existing } = await supabase
      .from("prospects")
      .select("id, project_id")
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
        project_id: info.latestProjectId,
        ref_code: info.slug ?? companyId,
      })
    } else if (!existing.project_id && info.latestProjectId) {
      // Backfill project_id onto existing prospect rows that pre-date the
      // project_id sync — so startProspectSequence has context.
      await supabase
        .from("prospects")
        .update({ project_id: info.latestProjectId })
        .eq("id", existing.id)
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

  // 4. Link Apollo prospects to claimed companies by email-domain match.
  // Apollo contacts are created before the target signs up on Arco; when a
  // matching company later appears (owner_id set = Draft or Listed), wire
  // the prospect row to it so the admin/sales Company column renders the
  // logo/services/city and we can jump straight to the company page.
  //
  // Free-mail domains (gmail, outlook, etc.) are skipped — matching by a
  // shared @gmail.com would collapse unrelated companies into one row.
  const FREE_EMAIL_DOMAINS = new Set([
    "gmail.com", "googlemail.com",
    "outlook.com", "hotmail.com", "hotmail.nl", "live.com", "live.nl",
    "yahoo.com", "yahoo.nl", "icloud.com", "me.com",
    "proton.me", "protonmail.com",
    "ziggo.nl", "kpn.nl", "kpnmail.nl", "planet.nl", "home.nl",
  ])
  const stripHost = (raw: string | null | undefined): string | null => {
    if (!raw) return null
    const cleaned = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
    return cleaned || null
  }

  const { data: unlinkedApollo } = await supabase
    .from("prospects")
    .select("id, email, company_id")
    .eq("source", "apollo")
    .is("company_id", null)

  if (unlinkedApollo && unlinkedApollo.length > 0) {
    const domainToProspects = new Map<string, string[]>()
    for (const p of unlinkedApollo) {
      const dom = p.email?.includes("@") ? p.email.split("@").pop()?.toLowerCase() ?? null : null
      if (!dom || FREE_EMAIL_DOMAINS.has(dom)) continue
      const bucket = domainToProspects.get(dom) ?? []
      bucket.push(p.id)
      domainToProspects.set(dom, bucket)
    }

    if (domainToProspects.size > 0) {
      const { data: claimedCompanies } = await supabase
        .from("companies")
        .select("id, name, domain, owner_id, status, created_at")
        .not("owner_id", "is", null)
        .not("domain", "is", null)

      // Status advances to 'active' when the company is Listed and 'company'
      // when it's Draft. The resolvedContact join only renders the owner
      // profile for those two stages — without this, a linked Apollo row
      // would still display the Apollo outreach email as the contact.
      const STATUS_ORDER: Record<string, number> = {
        prospect: 0, contacted: 1, visitor: 2, signup: 3, company: 4, active: 5,
      }

      for (const company of claimedCompanies ?? []) {
        const dom = stripHost(company.domain)
        if (!dom) continue
        const prospectIds = domainToProspects.get(dom)
        if (!prospectIds?.length) continue

        const targetStatus = company.status === "listed" ? "active" : "company"
        const targetRank = STATUS_ORDER[targetStatus]
        const createdAt = company.created_at as string

        const { data: currentRows } = await supabase
          .from("prospects")
          .select("id, status, company_created_at, converted_at")
          .in("id", prospectIds)

        for (const row of currentRows ?? []) {
          const currentRank = STATUS_ORDER[row.status ?? ""] ?? -1
          const updates: Record<string, unknown> = {
            company_id: company.id,
            company_name: company.name,
          }
          if (targetRank > currentRank) updates.status = targetStatus
          if (!row.company_created_at) updates.company_created_at = createdAt
          if (targetStatus === "active" && !row.converted_at) {
            updates.converted_at = createdAt
          }
          await supabase.from("prospects").update(updates).eq("id", row.id)
        }
      }
    }
  }
}

/**
 * Start prospect sequence — branches on source:
 *   - 'invites' → fires the new-professional invite sequence via the
 *     dispatcher (intro now + followup/final via drip queue), with the
 *     project + inviter context the prospect was originally tagged on.
 *   - 'arco'    → fires the original prospect outreach (prospect-intro
 *     now + prospect-followup/-final via drip queue).
 */
export async function startProspectSequence(prospectId: string) {
  const supabase = createServiceRoleSupabaseClient()

  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, email, company_id, source, emails_sent, emails_delivered, project_id")
    .eq("id", prospectId)
    .single()

  if (!prospect) return { success: false, error: "Prospect not found" }
  if (!prospect.company_id) return { success: false, error: "No linked company" }

  // Set sequence to active up front; rolled back to not_started if the send fails.
  await supabase.from("prospects").update({ sequence_status: "active" }).eq("id", prospectId)

  // ── Invite-source prospects: fire the new-professional sequence ──
  if (prospect.source === "invites") {
    if (!prospect.project_id) {
      await supabase.from("prospects").update({ sequence_status: "not_started" }).eq("id", prospectId)
      return { success: false, error: "Invite prospect has no linked project" }
    }
    const { dispatchProfessionalInvite } = await import("@/lib/invites/dispatch-professional-invite")
    const result = await dispatchProfessionalInvite(supabase, {
      recipientEmail: prospect.email,
      projectId: prospect.project_id,
      inviterName: "Project owner",
      recipientCompanyId: prospect.company_id,
    })
    if (!result.success) {
      await supabase.from("prospects").update({ sequence_status: "not_started" }).eq("id", prospectId)
      return { success: false, error: result.reason ?? "Failed to send invite email" }
    }
    // Dispatcher already upserts the prospect row's status / counters /
    // last_email_sent_at when it sends the intro, so no extra update here.
    await supabase.from("prospect_events").insert({
      prospect_id: prospectId,
      event_type: "email_sent",
      metadata: { template: "new_professional_invite", email: prospect.email },
    })
    return { success: true }
  }

  // ── Arco-source prospects: fire the original prospect outreach ──
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
  /** Stable id for the step. Known Arco templates get autocompletion;
   *  Apollo steps use the free-form `apollo-step-<n>` namespace and rely
   *  on the templateDisplayName fallback. */
  template:
    | "prospect-intro"
    | "prospect-followup"
    | "prospect-final"
    | "new-professional-invite"
    | "new-professional-followup"
    | "new-professional-final"
    | (string & {})
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
  /** Resend lifecycle event ('sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | …)
   *  populated by the Resend webhook. Null until the first event lands. */
  lastEvent: string | null
  openedAt: string | null
  clickedAt: string | null
}

/**
 * Source-specific context for the details popup. Apollo prospects already
 * carry their IDs on the prospect row, and arco prospects use the
 * client-side companyMap, so this lookup is only needed for invite
 * prospects: resolve the project they were tagged on plus the project
 * owner's company (the inviter), so the popup can show a real card
 * instead of just IDs.
 */
export type ProspectInviteContext = {
  project: {
    id: string
    slug: string | null
    title: string | null
    photoUrl: string | null
    projectType: string | null
    location: string | null
  } | null
  inviter: {
    id: string
    name: string | null
    slug: string | null
    logoUrl: string | null
    subtitle: string | null
  } | null
}

export async function getProspectInviteContext(prospectId: string): Promise<{
  success: boolean
  context?: ProspectInviteContext
  error?: string
}> {
  const supabase = createServiceRoleSupabaseClient()
  const { data: prospect } = await supabase
    .from("prospects")
    .select("project_id, source")
    .eq("id", prospectId)
    .maybeSingle()

  if (!prospect) return { success: false, error: "Prospect not found" }
  if (prospect.source !== "invites" || !prospect.project_id) {
    return { success: true, context: { project: null, inviter: null } }
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, slug, title, location, address_city")
    .eq("id", prospect.project_id)
    .maybeSingle()

  // Primary photo (lowest order_index) — same selection rule the email
  // dispatcher uses, kept consistent so the popup mirrors what gets sent.
  const { data: photoRow } = await supabase
    .from("project_photos")
    .select("url")
    .eq("project_id", prospect.project_id)
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle()

  // Inviter = project owner company (project_professionals.is_project_owner)
  const { data: ownerPP } = await supabase
    .from("project_professionals")
    .select("company_id")
    .eq("project_id", prospect.project_id)
    .eq("is_project_owner", true)
    .maybeSingle()

  const { data: inviterCompany } = ownerPP?.company_id
    ? await supabase
        .from("companies")
        .select("id, name, slug, logo_url, city, primary_service:categories!companies_primary_service_id_fkey(name)")
        .eq("id", ownerPP.company_id)
        .maybeSingle()
    : { data: null }

  const context: ProspectInviteContext = {
    project: project
      ? {
          id: project.id,
          slug: project.slug ?? null,
          title: project.title ?? null,
          photoUrl: photoRow?.url ?? null,
          projectType: null, // not surfaced in popup, kept on type for future use
          location: project.address_city ?? project.location ?? null,
        }
      : null,
    inviter: inviterCompany
      ? {
          id: inviterCompany.id,
          name: inviterCompany.name ?? null,
          slug: inviterCompany.slug ?? null,
          logoUrl: inviterCompany.logo_url ?? null,
          subtitle: [(inviterCompany as any).primary_service?.name, inviterCompany.city]
            .filter(Boolean)
            .join(" · ") || null,
        }
      : null,
  }

  return { success: true, context }
}

/**
 * Build a sequence display for an Apollo-source prospect by reading per-step
 * message state from Apollo's /emailer_messages/search endpoint. This is the
 * authoritative source — Apollo's contact-level endpoint exposes only the
 * contact's *position* in the sequence (which counts the next-scheduled step
 * already), not what's actually been sent.
 *
 * Apollo's API silently ignores per-contact filters on this endpoint, so we
 * filter by campaign and narrow client-side. Cost: 1 contact fetch + 1
 * campaign metadata fetch + 1–2 message search pages per popup open.
 */
async function getApolloSequence(prospect: {
  id: string
  source?: string | null
  apollo_contact_id?: string | null
  apollo_sequence_id?: string | null
  emails_sent?: number | null
  last_email_sent_at?: string | null
  sequence_status?: string | null
}): Promise<{ success: boolean; steps: ProspectSequenceStep[]; locale?: "nl" | "en" }> {
  const apiKey = process.env.APOLLO_API_KEY
  if (!apiKey || !prospect.apollo_contact_id) {
    return { success: true, steps: [] }
  }

  const apollo = (path: string, init?: RequestInit) =>
    fetch(`https://api.apollo.io/api/v1${path}`, {
      ...init,
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(8000),
    })

  // 1. Resolve the active campaign id + sequence status from the contact.
  let campaignId = prospect.apollo_sequence_id ?? null
  let sequenceStatus = prospect.sequence_status ?? "active"
  try {
    const r = await apollo(`/contacts/${prospect.apollo_contact_id}`)
    if (r.ok) {
      const d = await r.json()
      const cs = (d?.contact?.contact_campaign_statuses ?? [])[0]
      if (cs) {
        campaignId = cs.emailer_campaign_id ?? campaignId
        sequenceStatus = cs.status ?? sequenceStatus
      }
    }
  } catch {
    /* fall through to synced fields */
  }

  if (!campaignId) {
    return { success: true, steps: [] }
  }

  // 2. Campaign name + step total (used for the section label).
  let campaignName: string | null = null
  let campaignNumSteps = 0
  try {
    const r = await apollo(`/emailer_campaigns/${campaignId}`)
    if (r.ok) {
      const d = await r.json()
      campaignName = d?.emailer_campaign?.name ?? null
      campaignNumSteps = d?.emailer_campaign?.num_steps ?? 0
    }
  } catch {
    /* non-fatal — we can derive step total from the messages list below */
  }

  // 3. Pull every message in the campaign (Apollo's per-contact filter is
  // silently ignored here, so we filter client-side). Cap at 500 messages to
  // bound runtime; campaigns much larger than that need a different design.
  const messages: any[] = []
  for (let page = 1; page <= 5; page++) {
    try {
      const r = await apollo(`/emailer_messages/search`, {
        method: "POST",
        body: JSON.stringify({
          q_emailer_campaign_ids: [campaignId],
          page,
          per_page: 100,
        }),
      })
      if (!r.ok) break
      const d = await r.json()
      const batch: any[] = d?.emailer_messages ?? []
      messages.push(...batch)
      const total = d?.pagination?.total_entries ?? messages.length
      if (messages.length >= total || batch.length < 100) break
    } catch {
      break
    }
  }

  const mine = messages
    .filter((m) => m.contact_id === prospect.apollo_contact_id)
    .sort((a, b) => (a.campaign_position ?? 0) - (b.campaign_position ?? 0))

  if (mine.length === 0) {
    // No per-message data found — render a minimal placeholder rather than
    // misleading the admin into thinking the sequence is empty.
    return { success: true, steps: [] }
  }

  // 4. Map Apollo message states → our sequence-step statuses.
  //   completed / sent       → sent
  //   scheduled / pending    → queued
  //   failed                 → failed
  //   not_sent / unscheduled → cancelled (with reason)
  const statusOf = (apolloStatus: string | null | undefined): ProspectSequenceStep["status"] => {
    switch ((apolloStatus ?? "").toLowerCase()) {
      case "completed":
      case "sent":
        return "sent"
      case "scheduled":
      case "pending":
        return "queued"
      case "failed":
      case "bounced":
        return "failed"
      case "not_sent":
      case "unscheduled":
      case "skipped":
        return "cancelled"
      default:
        return "missing"
    }
  }

  // Apollo's `due_at` is the scheduled send time; `completed_at` is the actual
  // send time. Pin whichever applies to the row's status.
  const totalSteps = Math.max(campaignNumSteps, mine[mine.length - 1]?.campaign_position ?? mine.length)

  const steps: ProspectSequenceStep[] = []
  for (let i = 1; i <= totalSteps; i++) {
    const m = mine.find((x) => (x.campaign_position ?? 0) === i)
    const baseLabel = i === 1 && campaignName ? `${campaignName} · Step 1` : `Step ${i}`

    if (!m) {
      // Step exists in the campaign template but not yet scheduled for this
      // contact (typical for unfinished sequences where later steps are only
      // materialised once the prior one fires).
      steps.push({
        template: `apollo-step-${i}`,
        label: baseLabel,
        status: sequenceStatus === "finished" ? "finished" : sequenceStatus === "paused" ? "paused" : "missing",
        timestamp: null,
        cancelledReason: null,
        attemptCount: 0,
        lastError: null,
        lastEvent: null,
        openedAt: null,
        clickedAt: null,
      })
      continue
    }

    const stepStatus = statusOf(m.status)
    steps.push({
      template: `apollo-step-${i}`,
      label: m.subject ? (i === 1 && campaignName ? `${campaignName} · ${m.subject}` : m.subject) : baseLabel,
      status: stepStatus,
      timestamp: m.completed_at ?? m.due_at ?? null,
      cancelledReason: m.failure_reason ?? m.not_sent_reason ?? null,
      attemptCount: 0,
      lastError: m.failure_reason ?? null,
      lastEvent: null,
      openedAt: null,
      clickedAt: null,
    })
  }

  return { success: true, steps }
}

export async function getProspectSequence(prospectId: string): Promise<{
  success: boolean
  steps?: ProspectSequenceStep[]
  /** Language the sequence went out in (or will go out in) — resolved
   *  with the same priority order sendTransactionalEmail uses, so the
   *  admin popup shows the real locale instead of a TLD-only guess. */
  locale?: "nl" | "en"
  error?: string
}> {
  const supabase = createServiceRoleSupabaseClient()

  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, company_id, email, source, apollo_contact_id, apollo_sequence_id, emails_sent, last_email_sent_at, sequence_status")
    .eq("id", prospectId)
    .maybeSingle()

  if (!prospect) return { success: false, error: "Prospect not found" }

  // Apollo: synthesise sequence steps from the contact's campaign on Apollo,
  // not from our own email_drip_queue (Apollo runs the sequence externally).
  if ((prospect as any).source === "apollo") {
    return getApolloSequence(prospect as any)
  }

  if (!prospect.company_id) {
    // Arco / invites prospects need a linked company to resolve the queue.
    return { success: true, steps: [] }
  }

  const { resolveRecipientLanguage } = await import("@/lib/email-service")
  const locale = await resolveRecipientLanguage({
    email: prospect.email,
    companyId: prospect.company_id,
  })

  // Pick the template trio for this prospect's source. 'arco' = the original
  // outbound prospect series; 'invites' = the new-professional sequence.
  const isInviteSeries = prospect.source === "invites"
  const introTemplate = isInviteSeries ? "new_professional_invite" : "prospect_intro"
  const followupTemplate = isInviteSeries ? "new-professional-followup" : "prospect-followup"
  const finalTemplate = isInviteSeries ? "new-professional-final" : "prospect-final"

  // Intro: read from company_outreach (intro is sent direct via Resend, not
  // via email_drip_queue, so it's the only template that ever lands here).
  const { data: outreachRows } = await supabase
    .from("company_outreach" as never)
    .select("template, sent_at, opened_at, clicked_at, last_event_cached")
    .eq("company_id", prospect.company_id)
    .eq("template", introTemplate)
    .order("sent_at", { ascending: false })
    .limit(1)

  // Followup + Final: read from email_drip_queue. Most recent matching row wins.
  const { data: queueRows } = await supabase
    .from("email_drip_queue")
    .select("template, send_at, sent_at, cancelled_at, cancelled_reason, attempt_count, last_error, opened_at, clicked_at, last_event_cached")
    .eq("company_id", prospect.company_id)
    .in("template", [followupTemplate, finalTemplate])
    .order("created_at", { ascending: false })

  // Build a map: template → most recent row (we sorted desc above)
  const queueByTemplate = new Map<string, NonNullable<typeof queueRows>[number]>()
  for (const row of queueRows ?? []) {
    if (!queueByTemplate.has(row.template)) {
      queueByTemplate.set(row.template, row)
    }
  }

  const introRow = (outreachRows ?? [])[0] as
    | { template: string; sent_at: string | null; opened_at: string | null; clicked_at: string | null; last_event_cached: string | null }
    | undefined
  const followupRow = queueByTemplate.get(followupTemplate)
  const finalRow = queueByTemplate.get(finalTemplate)

  const queueRowToStep = (
    template: ProspectSequenceStep["template"],
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
        lastEvent: null,
        openedAt: null,
        clickedAt: null,
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
      lastEvent: (row as any).last_event_cached ?? null,
      openedAt: (row as any).opened_at ?? null,
      clickedAt: (row as any).clicked_at ?? null,
    }
  }

  const introStepTemplate: ProspectSequenceStep["template"] =
    isInviteSeries ? "new-professional-invite" : "prospect-intro"
  const steps: ProspectSequenceStep[] = [
    {
      template: introStepTemplate,
      label: isInviteSeries ? "Invite" : "Intro",
      status: introRow?.sent_at ? "sent" : "missing",
      timestamp: introRow?.sent_at ?? null,
      cancelledReason: null,
      attemptCount: 0,
      lastError: null,
      lastEvent: introRow?.last_event_cached ?? null,
      openedAt: introRow?.opened_at ?? null,
      clickedAt: introRow?.clicked_at ?? null,
    },
    queueRowToStep(followupTemplate, "Follow-up", followupRow),
    queueRowToStep(finalTemplate, "Final", finalRow),
  ]

  return { success: true, steps, locale }
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
    .select("id, company_id, email, sequence_status, source")
    .eq("id", prospectId)
    .single()

  if (!prospect) return { success: false, error: "Prospect not found" }
  if (prospect.sequence_status !== "paused") {
    return { success: false, error: "Sequence is not paused" }
  }

  if (prospect.company_id) {
    try {
      const { nextBusinessSlot } = await import("@/lib/date-utils")
      // Pick the right template trio + sequence label for this prospect's
      // source. 'arco' → original prospect outreach; 'invites' → the new
      // professional-invite sequence.
      const isInviteSeries = prospect.source === "invites"
      const sequenceName = isInviteSeries ? "new-professional-invite" : "prospect-outreach"
      const stepConfig = (isInviteSeries
        ? [
            { template: "new-professional-followup" as const, step: 1, sendAt: nextBusinessSlot(3).toISOString() },
            { template: "new-professional-final" as const, step: 2, sendAt: nextBusinessSlot(7).toISOString() },
          ]
        : [
            { template: "prospect-followup" as const, step: 1, sendAt: nextBusinessSlot(3).toISOString() },
            { template: "prospect-final" as const, step: 2, sendAt: nextBusinessSlot(7).toISOString() },
          ])

      // Skip pro-audience companies (photographers). Their entry to Arco is
      // via architect credit, not outbound prospect outreach — re-enqueuing
      // a sequence on resume would spam them. One audience check up front
      // saves an extra read per step.
      const { isProAudienceCompany } = await import("@/lib/drip-queue")
      const skipResumeDrip = await isProAudienceCompany(supabase, prospect.company_id)

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
        if (skipResumeDrip) continue

        const { error: insertError } = await supabase
          .from("email_drip_queue")
          .insert({
            company_id: prospect.company_id,
            email: lastRow?.email ?? prospect.email,
            template,
            sequence: sequenceName,
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
 * Restart a finished sequence. Branches on source the same way
 * startProspectSequence does:
 *   - 'invites' → re-fire the new-professional invite via the dispatcher
 *     using the prospect's stored project_id (intro now via Resend,
 *     followup + final back into the drip queue).
 *   - 'arco'    → re-send prospect-intro and re-enqueue followup + final.
 */
export async function restartProspectSequence(prospectId: string) {
  const supabase = createServiceRoleSupabaseClient()
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, email, company_id, source, emails_sent, emails_delivered, sequence_status, project_id")
    .eq("id", prospectId)
    .single()

  if (!prospect) return { success: false, error: "Prospect not found" }
  if (!prospect.company_id) return { success: false, error: "No linked company" }

  const previousStatus = prospect.sequence_status ?? "not_started"
  await supabase.from("prospects").update({ sequence_status: "active" }).eq("id", prospectId)

  // ── Invite-source restart: dispatcher with project context ──
  if (prospect.source === "invites") {
    if (!prospect.project_id) {
      await supabase.from("prospects").update({ sequence_status: previousStatus }).eq("id", prospectId)
      return { success: false, error: "Invite prospect has no linked project" }
    }
    const { dispatchProfessionalInvite } = await import("@/lib/invites/dispatch-professional-invite")
    const result = await dispatchProfessionalInvite(supabase, {
      recipientEmail: prospect.email,
      projectId: prospect.project_id,
      inviterName: "Project owner",
      recipientCompanyId: prospect.company_id,
    })
    if (!result.success) {
      await supabase.from("prospects").update({ sequence_status: previousStatus }).eq("id", prospectId)
      return { success: false, error: result.reason ?? "Failed to send invite email" }
    }
    await supabase.from("prospect_events").insert({
      prospect_id: prospectId,
      event_type: "email_resent",
      metadata: { template: "new_professional_invite", email: prospect.email },
    })
    return { success: true }
  }

  // ── Arco-source restart ──
  const { sendProspectEmailAction } = await import("@/app/admin/professionals/actions")
  const result = await sendProspectEmailAction({
    companyId: prospect.company_id,
    emailTo: prospect.email,
  })

  if (!result.success) {
    await supabase.from("prospects").update({ sequence_status: previousStatus }).eq("id", prospectId)
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

    // ── Drip queue backfill ──
    // Followup / final rows sent before migration 144 + the cron update
    // landed have NULL resend_message_id, so the Resend webhook can't fan
    // open / click events back to them. Match by the `template` tag we
    // attach to every send + recipient + nearest sent_at, then patch the
    // row with the message id and the engagement state Resend reports.
    const { data: unmatchedDrips } = await supabase
      .from("email_drip_queue")
      .select("id, template, email, sent_at")
      .is("resend_message_id", null)
      .not("sent_at", "is", null)

    type DripCandidate = { id: string; sent_at: string }
    const dripsByKey = new Map<string, DripCandidate[]>()
    for (const row of unmatchedDrips ?? []) {
      if (!row.email || !row.template || !row.sent_at) continue
      const key = `${row.template}::${row.email.toLowerCase().trim()}`
      const list = dripsByKey.get(key) ?? []
      list.push({ id: row.id as string, sent_at: row.sent_at as string })
      dripsByKey.set(key, list)
    }

    let dripPatched = 0
    if (dripsByKey.size > 0) {
      for (const email of allEmails) {
        const tags = (email as any).tags
        const templateTag = Array.isArray(tags)
          ? tags.find((t: { name?: string }) => t?.name === "template")?.value
          : undefined
        if (!templateTag) continue
        const recipients: string[] = Array.isArray(email.to) ? email.to : [email.to]
        for (const to of recipients) {
          if (!to) continue
          const key = `${templateTag}::${to.toLowerCase().trim()}`
          const candidates = dripsByKey.get(key)
          if (!candidates || candidates.length === 0) continue
          // Pick the row whose sent_at is closest to Resend's created_at —
          // protects against a re-enqueue having multiple rows for the
          // same (template, recipient) pair.
          const resendTs = new Date(email.created_at).getTime()
          let best = candidates[0]
          let bestDelta = Math.abs(new Date(best.sent_at).getTime() - resendTs)
          for (const c of candidates.slice(1)) {
            const delta = Math.abs(new Date(c.sent_at).getTime() - resendTs)
            if (delta < bestDelta) { best = c; bestDelta = delta }
          }
          const lastEvent = (email as any).last_event ?? "sent"
          const update: Record<string, unknown> = {
            resend_message_id: email.id,
            last_event_cached: lastEvent,
            last_event_cached_at: new Date().toISOString(),
          }
          // Stamp opened_at / clicked_at when Resend reports them — engagement
          // function uses both lastEvent and the timestamp columns. Resend's
          // list response only carries created_at, so we approximate the
          // engagement timestamp with that (good enough for the popup which
          // only checks for non-null).
          if (lastEvent === "opened" || lastEvent === "clicked") {
            update.opened_at = email.created_at
          }
          if (lastEvent === "clicked") {
            update.clicked_at = email.created_at
          }
          await supabase.from("email_drip_queue").update(update as never).eq("id", best.id)
          dripPatched++
          dripsByKey.set(key, candidates.filter((c) => c.id !== best.id))
        }
      }
    }

    // Record sync timestamp so we don't re-sync within the hour
    await supabase
      .from("email_stats_cache" as any)
      .upsert({ template_id: "_prospect_sync", cached_at: new Date().toISOString(), sends: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 }, { onConflict: "template_id" })

    return { synced, dripPatched }
  } catch {
    return { synced: 0 }
  }
}
