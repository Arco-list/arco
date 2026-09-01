/**
 * Dispatch a professional-invite from a project owner to a tagged
 * collaborator. Branches on whether the recipient's company has been
 * claimed:
 *
 *   - Claimed (owner_id != null) → one-shot 'professional-invite' email,
 *     same as before. The recipient already has an Arco account or can
 *     sign in via the confirmUrl.
 *
 *   - Unclaimed (owner_id == null) → fires the new three-step "new
 *     professional invite" sequence:
 *       1. 'new-professional-invite'   immediate (Resend)
 *       2. 'new-professional-followup' +3 business days (drip queue)
 *       3. 'new-professional-final'    +7 business days (drip queue)
 *     A prospects row is upserted with source='invites' so the company
 *     shows up in /admin/sales and the migration-134 trigger will cancel
 *     pending drips when the prospect signs up (status → 'signup' /
 *     'company' / 'active').
 *
 * Used by every project-invite path so there's a single dispatch point:
 *   - createUnlistedCompanyAction (always unclaimed by definition)
 *   - confirmLinkExistingCompanyAction (either branch)
 *   - sendInviteEmailAction (re-send button on the project edit page)
 */

import type { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import {
  sendProfessionalInviteEmail,
  sendTransactionalEmail,
  checkUserAndGenerateInviteUrl,
  type EmailVariables,
} from "@/lib/email-service"

type Supabase = ReturnType<typeof createServiceRoleSupabaseClient>

export type DispatchInviteInput = {
  /** Address the invite is going to (the invited company's contact). */
  recipientEmail: string
  /** Project the recipient was credited on. */
  projectId: string
  /** Display name of the inviter (project owner's user). Falls back to
   *  the inviter company name in the rendered email. */
  inviterName: string
  /** When the caller already knows the company (e.g. linkExistingCompany
   *  action), pass it to skip the lookup. */
  recipientCompanyId?: string
  /** The project_professionals row this invite is for. When known, the
   *  dispatch stamp lands on exactly that row; otherwise on the row(s)
   *  matching (project, email). */
  creditId?: string
}

export type DispatchInviteResult = {
  success: boolean
  /** What we actually did, for logging / call-site decisions. */
  sequence: "one-shot" | "drip" | "skipped"
  /** Set when sequence is 'skipped' (project not published, etc). */
  reason?: string
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.arcolist.com"

/** Cold recipients get one invite chain at a time: a second project's
 *  credit inside this window is skipped by the publish sweep, after it
 *  they're eligible again (new project, new reason to claim). */
export const RECENT_INVITE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

/** Stamp the credit row(s) an invite covered, so the publish-time sweep
 *  never emails the same credit twice (publish → unlist → publish again
 *  used to). Keyed on the row id when the caller has it, else on
 *  (project, email). */
async function markInviteDispatched(
  supabase: Supabase,
  input: { creditId?: string; projectId: string; recipientEmail: string },
): Promise<void> {
  const base = supabase
    .from("project_professionals")
    .update({ invite_dispatched_at: new Date().toISOString() })
    .eq("is_project_owner", false)
    .is("invite_dispatched_at", null)
  const { error } = input.creditId
    ? await base.eq("id", input.creditId)
    : await base.eq("project_id", input.projectId).ilike("invited_email", input.recipientEmail.trim())
  if (error) console.error("markInviteDispatched failed", error.message)
}

/** Resolve project-shaped variables once; reused for every email in the
 *  series. Returns nullish when the project is missing or unpublished. */
async function resolveInviteContext(supabase: Supabase, projectId: string) {
  const { data: project } = await supabase
    .from("projects")
    .select("id, slug, title, status, location, address_city, building_type, project_type, project_type_category_id")
    .eq("id", projectId)
    .maybeSingle()

  if (!project) return null
  if (project.status !== "published" && project.status !== "completed") return null

  const [{ data: projectPhoto }, { data: ownerPP }] = await Promise.all([
    supabase
      .from("project_photos")
      .select("url")
      .eq("project_id", projectId)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("project_professionals")
      .select("company_id")
      .eq("project_id", projectId)
      .eq("is_project_owner", true)
      .maybeSingle(),
  ])

  const { data: ownerCompany } = ownerPP?.company_id
    ? await supabase
        .from("companies")
        .select("name, logo_url, slug, city, primary_service:categories!companies_primary_service_id_fkey(name)")
        .eq("id", ownerPP.company_id)
        .maybeSingle()
    : { data: null }
  const ownerCompanyServiceName = (ownerCompany as any)?.primary_service?.name ?? null
  const ownerCompanySubtitle =
    [ownerCompanyServiceName, (ownerCompany as any)?.city].filter(Boolean).join(" · ") || null
  const ownerCompanyPageUrl =
    (ownerCompany as any)?.slug ? `${SITE_URL}/professionals/${(ownerCompany as any).slug}` : null

  // Resolve building-type label (matches the existing inline logic in
  // dashboard/edit/actions.ts).
  let projectType: string | undefined
  const bt = project.building_type
  const isUuid = bt && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bt)
  if (bt && !isUuid) {
    projectType = bt.charAt(0).toUpperCase() + bt.slice(1).replace(/-/g, " ")
  }
  if (!projectType) {
    const idsToTry = [isUuid ? bt : null, project.project_type_category_id].filter(Boolean) as string[]
    for (const catId of idsToTry) {
      const { data: cat } = await supabase.from("categories").select("name").eq("id", catId).maybeSingle()
      if (cat?.name) { projectType = cat.name; break }
    }
  }
  if (!projectType && project.project_type) projectType = project.project_type

  const projectLink = `${SITE_URL}/projects/${project.slug ?? project.id}`

  return {
    project,
    projectPhotoUrl: projectPhoto?.url ?? null,
    ownerCompanyName: ownerCompany?.name ?? null,
    ownerCompanyLogoUrl: ownerCompany?.logo_url ?? null,
    ownerCompanySubtitle,
    ownerCompanyPageUrl,
    projectType: projectType ?? null,
    projectLink,
  }
}

/** Find the recipient company. If the caller passed companyId we trust
 *  it; otherwise look up by invited_email on this project. */
async function resolveRecipientCompany(
  supabase: Supabase,
  input: { recipientEmail: string; projectId: string; recipientCompanyId?: string },
): Promise<{ id: string; name: string; slug: string | null; ownerId: string | null; logoUrl: string | null; heroPhotoUrl: string | null; city: string | null; serviceName: string | null } | null> {
  let companyId = input.recipientCompanyId

  if (!companyId) {
    const { data: pp } = await supabase
      .from("project_professionals")
      .select("company_id")
      .eq("project_id", input.projectId)
      .eq("invited_email", input.recipientEmail)
      .not("company_id", "is", null)
      .maybeSingle()
    companyId = pp?.company_id ?? undefined
  }

  if (!companyId) return null

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, owner_id, logo_url, hero_photo_url, city, primary_service:categories!companies_primary_service_id_fkey(name)")
    .eq("id", companyId)
    .maybeSingle()

  if (!company) return null

  return {
    id: company.id,
    name: company.name,
    slug: company.slug ?? null,
    ownerId: company.owner_id ?? null,
    logoUrl: company.logo_url ?? null,
    heroPhotoUrl: company.hero_photo_url ?? null,
    city: company.city ?? null,
    serviceName: (company.primary_service as any)?.name ?? null,
  }
}

export async function dispatchProfessionalInvite(
  supabase: Supabase,
  input: DispatchInviteInput,
): Promise<DispatchInviteResult> {
  const ctx = await resolveInviteContext(supabase, input.projectId)
  if (!ctx) return { success: false, sequence: "skipped", reason: "project not published" }

  const recipient = await resolveRecipientCompany(supabase, input)

  // One-click acceptance. Resolve the credit row this invite is for so
  // the token can be bound to it (the caller passes creditId on the
  // publish sweep; otherwise match on project + address).
  let acceptUrl: string | undefined
  {
    let creditId = input.creditId
    if (!creditId) {
      const { data: row } = await supabase
        .from("project_professionals")
        .select("id")
        .eq("project_id", input.projectId)
        .eq("is_project_owner", false)
        .ilike("invited_email", input.recipientEmail.trim())
        .maybeSingle()
      creditId = row?.id
    }
    if (creditId) {
      try {
        const { signAcceptToken } = await import("./accept-token")
        const token = signAcceptToken({ creditId, email: input.recipientEmail })
        acceptUrl = `${SITE_URL}/invite/accept?t=${encodeURIComponent(token)}`
      } catch (err) {
        // Missing signing secret must not block the invite itself.
        console.error("Could not sign accept token", err)
      }
    }
  }

  // Build the variables shared by every email in the series.
  const baseVars: EmailVariables = {
    project_owner: input.inviterName,
    project_name: ctx.project.title ?? undefined,
    project_title: ctx.project.title ?? undefined,
    project_image: ctx.projectPhotoUrl ?? undefined,
    project_location: ctx.project.address_city ?? ctx.project.location ?? undefined,
    project_type: ctx.projectType ?? undefined,
    project_link: ctx.projectLink,
  }

  // Inviter (Annebel/Archie) badge is rendered from `company_name` /
  // `company_logo_url` in the existing professional-invite renderer; the
  // new templates read `inviter_company_name` / `inviter_logo_url`.
  // Pass both so neither template loses the badge.
  const inviterVars: EmailVariables = {
    ...baseVars,
    company_name: ctx.ownerCompanyName ?? undefined,
    company_logo_url: ctx.ownerCompanyLogoUrl ?? undefined,
    company_subtitle: ctx.ownerCompanySubtitle ?? undefined,
    company_page_url: ctx.ownerCompanyPageUrl ?? undefined,
    inviter_company_name: ctx.ownerCompanyName ?? undefined,
    inviter_logo_url: ctx.ownerCompanyLogoUrl ?? undefined,
    inviter_subtitle: ctx.ownerCompanySubtitle ?? undefined,
    inviter_page_url: ctx.ownerCompanyPageUrl ?? undefined,
  }

  // ── Branch on claim status ──
  // Claimed company, or no company row at all, gets the one-shot invite.
  // (A credit whose email resolves to no company — legacy email-only rows
  // — still deserves the plain invite; the drip sequence needs a page to
  // claim, so it only runs for unclaimed companies.)
  if (!recipient || recipient.ownerId != null) {
    // confirmUrl carries the project context so a sign-in lands them on
    // the invite acceptance page.
    const { confirmUrl } = await checkUserAndGenerateInviteUrl(input.recipientEmail, input.projectId)
    const result = await sendProfessionalInviteEmail(input.recipientEmail, {
      project_owner: input.inviterName,
      company_name: ctx.ownerCompanyName ?? undefined,
      company_logo_url: ctx.ownerCompanyLogoUrl ?? undefined,
      company_subtitle: ctx.ownerCompanySubtitle ?? undefined,
      project_name: ctx.project.title ?? "",
      project_title: ctx.project.title ?? "",
      project_image: ctx.projectPhotoUrl ?? undefined,
      project_location: ctx.project.address_city ?? ctx.project.location ?? undefined,
      project_type: ctx.projectType ?? undefined,
      project_link: ctx.projectLink,
      confirmUrl,
      accept_url: acceptUrl,
    } as any)
    if (result.skipped) return { success: false, sequence: "skipped", reason: "recipient opted out" }
    if (result.success) await markInviteDispatched(supabase, input)
    return { success: result.success, sequence: "one-shot" }
  }

  // ── Unclaimed: kick off the new three-step sequence ──

  const claimUrl = `${SITE_URL}/businesses/professionals?inviteEmail=${encodeURIComponent(input.recipientEmail)}&companyId=${recipient.id}`
  const companyPageUrl = `${SITE_URL}/professionals/${recipient.slug ?? recipient.id}`
  const companySubtitle = [recipient.serviceName, recipient.city].filter(Boolean).join(" · ") || null

  // For the new sequence: company_* fields refer to the RECIPIENT (the
  // page they will claim), inviter_* fields refer to the project owner who
  // tagged them.
  const sequenceVars: EmailVariables = {
    ...inviterVars,
    company_name: recipient.name,
    company_logo_url: undefined,
    company_page_url: companyPageUrl,
    company_subtitle: companySubtitle ?? undefined,
    logo_url: recipient.logoUrl ?? undefined,
    hero_image_url: recipient.heroPhotoUrl ?? undefined,
    inviter_company_name: ctx.ownerCompanyName ?? undefined,
    inviter_logo_url: ctx.ownerCompanyLogoUrl ?? undefined,
    inviter_subtitle: ctx.ownerCompanySubtitle ?? undefined,
    inviter_page_url: ctx.ownerCompanyPageUrl ?? undefined,
    claim_url: claimUrl,
    accept_url: acceptUrl,
  }

  // 1. Intro — direct Resend send.
  const introResult = await sendTransactionalEmail(
    input.recipientEmail,
    "new-professional-invite",
    sequenceVars,
    { companyId: recipient.id },
  )
  // Opted out: nothing went out, so nothing downstream may claim it did
  // (no Contacted status, no followups, no dispatch stamp).
  if (introResult.skipped) {
    return { success: false, sequence: "skipped", reason: "recipient opted out" }
  }
  if (introResult.success) await markInviteDispatched(supabase, input)

  // Mirror the prospect-intro flow: log every direct intro send to
  // company_outreach so the Outreach Sequence popup in /admin/sales has a
  // row to render for the intro step. Non-fatal if it fails — the email
  // already went out.
  if (introResult.success) {
    await supabase.from("company_outreach" as any).insert({
      company_id: recipient.id,
      email_to: input.recipientEmail,
      template: "new_professional_invite",
      resend_message_id: introResult.messageId ?? null,
    })
  }

  // 2. Upsert the prospects row so the company shows in /admin/sales and
  //    so migration 134's status-advance trigger can cancel pending drips
  //    when this person signs up. We do not abort if the upsert fails —
  //    the intro already went out and the followup/final still get
  //    enqueued; an admin can clean up an orphan drip row by hand.
  const { data: existingProspect } = await supabase
    .from("prospects")
    .select("id, sequence_status, emails_sent, emails_delivered")
    .eq("company_id", recipient.id)
    .eq("source", "invites")
    .maybeSingle()

  if (!existingProspect) {
    await supabase.from("prospects").insert({
      email: input.recipientEmail,
      company_name: recipient.name,
      city: recipient.city,
      source: "invites",
      status: introResult.success ? "contacted" : "prospect",
      sequence_status: introResult.success ? "active" : "not_started",
      emails_sent: introResult.success ? 1 : 0,
      emails_delivered: introResult.success ? 1 : 0,
      last_email_sent_at: introResult.success ? new Date().toISOString() : null,
      company_id: recipient.id,
      // Project context — needed by /admin/sales "Start sequence" so we can
      // re-fire the dispatcher with the same project. Without it, restart
      // / pause-resume actions can't reconstruct what the prospect was
      // tagged on.
      project_id: input.projectId,
      ref_code: recipient.slug ?? recipient.id,
    })
  } else if (introResult.success) {
    await supabase.from("prospects").update({
      sequence_status: "active",
      status: "contacted",
      emails_sent: (existingProspect.emails_sent ?? 0) + 1,
      emails_delivered: (existingProspect.emails_delivered ?? 0) + 1,
      last_email_sent_at: new Date().toISOString(),
    }).eq("id", existingProspect.id)
  }

  // 3. Enqueue the followup + final. Same partial-unique-index dedup as
  //    the prospect outreach: a duplicate enqueue for (company_id,
  //    template) WHERE pending will hit 23505 and silently no-op.
  // Skip for pro-audience companies (photographers): they reach Arco via
  // architect credit, not via the new-professional invite sequence — and
  // shouldn't get followups even if dispatch is somehow triggered for them.
  const { isProAudienceCompany, claimNextSendSlot } = await import("@/lib/drip-queue")
  if (!(await isProAudienceCompany(supabase, recipient.id))) {
    const { nextBusinessSlot } = await import("@/lib/date-utils")
    const followupSendAt = (await claimNextSendSlot(supabase, nextBusinessSlot(3))).toISOString()
    const finalSendAt = (await claimNextSendSlot(supabase, nextBusinessSlot(7))).toISOString()
    await supabase
      .from("email_drip_queue")
      .insert([
        {
          company_id: recipient.id,
          email: input.recipientEmail,
          template: "new-professional-followup",
          sequence: "new-professional-invite",
          step: 1,
          variables: sequenceVars as Record<string, unknown>,
          send_at: followupSendAt,
        },
        {
          company_id: recipient.id,
          email: input.recipientEmail,
          template: "new-professional-final",
          sequence: "new-professional-invite",
          step: 2,
          variables: sequenceVars as Record<string, unknown>,
          send_at: finalSendAt,
        },
      ] as never)
  }

  // Account stage: the intro send moves the funnel to Contacted; let the
  // resolver recompute the Apollo account stage for the company.
  if (introResult.success) {
    try {
      const { syncCompanyToApollo } = await import("@/lib/company-apollo-sync")
      await syncCompanyToApollo(recipient.id)
    } catch (err) {
      console.error("Failed to sync Apollo account stage after invite dispatch", err)
    }
  }

  return { success: introResult.success, sequence: "drip" }
}

/**
 * Dispatch invites that were credited while the project was still a
 * draft. The per-credit dispatcher refuses unpublished projects, and
 * nothing re-triggered on publish — 8 credits on "Hedendaags" (Aug 25)
 * sat at Not started forever. Call this whenever a project transitions
 * to published.
 *
 * Guards: only non-owner credits with status 'invited' and an email;
 * skips credits whose invite already went out (invite_dispatched_at —
 * re-publish never re-sends), and cold recipients who started an invite
 * chain within RECENT_INVITE_WINDOW_MS on another project. Claimed
 * companies get their one-shot per credit regardless: accepting a credit
 * on project B is a different action from accepting one on project A.
 */
export async function dispatchPendingInvitesForProject(
  supabase: Supabase,
  projectId: string,
): Promise<{ dispatched: number; skipped: number }> {
  const { data: credits } = await supabase
    .from("project_professionals")
    .select("id, invited_email, company_id, invite_dispatched_at")
    .eq("project_id", projectId)
    .eq("is_project_owner", false)
    .eq("status", "invited")
    .not("invited_email", "is", null)
    .neq("invited_email", "")

  const rows = (credits ?? []) as Array<{ id: string; invited_email: string; company_id: string | null; invite_dispatched_at: string | null }>
  if (rows.length === 0) return { dispatched: 0, skipped: 0 }

  // Inviter display name: the project owner's company.
  const { data: ownerPP } = await supabase
    .from("project_professionals")
    .select("company_id")
    .eq("project_id", projectId)
    .eq("is_project_owner", true)
    .maybeSingle()
  let inviterName = "the project owner"
  if (ownerPP?.company_id) {
    const { data: ownerCompany } = await supabase
      .from("companies")
      .select("name")
      .eq("id", ownerPP.company_id)
      .maybeSingle()
    if (ownerCompany?.name) inviterName = ownerCompany.name
  }

  let dispatched = 0
  let skipped = 0
  const recentSince = new Date(Date.now() - RECENT_INVITE_WINDOW_MS).toISOString()

  // Preserved from the legacy admin publish loop: a credit whose address
  // belongs to someone who has since joined Arco gets linked to their
  // company, so the project shows up in that company's Listings. The
  // editor does this at insert time; this catches credits whose owner
  // joined afterwards.
  // professionals has no email column — identity lives in auth.users,
  // which is how the legacy loop resolved it too.
  const linkKnownProfessionals = async () => {
    const unlinked = rows.filter(r => !r.company_id && r.invited_email?.trim())
    if (unlinked.length === 0) return
    const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const idByEmail = new Map(
      (userList?.users ?? [])
        .filter(u => u.email)
        .map(u => [u.email!.toLowerCase(), u.id] as const),
    )
    for (const row of unlinked) {
      const userId = idByEmail.get(row.invited_email.trim().toLowerCase())
      if (!userId) continue
      const { data: pro } = await supabase
        .from("professionals")
        .select("id, company_id")
        .eq("user_id", userId)
        .maybeSingle()
      if (!pro?.company_id) continue
      await supabase
        .from("project_professionals")
        .update({ professional_id: pro.id, company_id: pro.company_id })
        .eq("id", row.id)
      row.company_id = pro.company_id
    }
  }
  await linkKnownProfessionals()
  for (const credit of rows) {
    const email = credit.invited_email.trim().toLowerCase()
    if (!email) { skipped++; continue }
    // Placeholder addresses from "link company without email" never
    // went anywhere and never should.
    if (/@arcolist\.com$/i.test(email)) { skipped++; continue }
    // This credit's invite already went out.
    if (credit.invite_dispatched_at) { skipped++; continue }
    // The 30-day window only applies to COLD recipients: it exists to
    // avoid stacking claim-chains on someone who hasn't engaged. A
    // claimed company is a customer being told about a new credit, so it
    // always gets its one-shot.
    const { data: recipientCompany } = credit.company_id
      ? await supabase.from("companies").select("owner_id").eq("id", credit.company_id).maybeSingle()
      : { data: null }
    if (!recipientCompany?.owner_id) {
      const { data: recentChain } = await supabase
        .from("email_events")
        .select("id")
        .eq("recipient_email", email)
        .eq("template", "new-professional-invite")
        .eq("event_type", "sent")
        .gte("occurred_at", recentSince)
        .limit(1)
        .maybeSingle()
      if (recentChain) { skipped++; continue }
    }
    try {
      const result = await dispatchProfessionalInvite(supabase, {
        recipientEmail: credit.invited_email,
        projectId,
        inviterName,
        recipientCompanyId: credit.company_id ?? undefined,
        creditId: credit.id,
      })
      if (result.success) dispatched++
      else skipped++
    } catch {
      skipped++
    }
  }
  return { dispatched, skipped }
}
