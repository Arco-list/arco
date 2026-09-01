import "server-only"

import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"

import { verifyAcceptToken } from "./accept-token"

/**
 * Accept a project credit from an emailed token.
 *
 * Two paths, decided by whether the credited company has been claimed:
 *
 *   claimed (owner_id set) — the caller MUST be signed in as someone who
 *     belongs to that company. The token proves the invite is genuine; it
 *     is never sufficient on its own, or a forwarded email would let a
 *     third party act for the business.
 *
 *   unclaimed — there is no account to authenticate against, so consent
 *     comes from possession of the invited mailbox plus an explicit
 *     confirmation click on our page. Never accept on a bare GET: mail
 *     scanners and preview panes issue those without a human involved.
 *
 * Accepting always sets the credit to 'live_on_page' — the status a
 * project takes when it goes live.
 *
 * What it does NOT do is publish an unclaimed company. Acceptance is not
 * the gate for a company page: the company stays 'invited' until someone
 * actually claims it. Creating the company is what flips it to 'listed',
 * and it flips immediately because a live credit already exists by then.
 */

export type AcceptOutcome =
  | { status: "accepted"; projectId: string; projectSlug: string | null; companyId: string | null }
  | { status: "already_accepted"; projectId: string; projectSlug: string | null }
  | { status: "needs_signin"; email: string }
  | { status: "wrong_account"; email: string }
  | { status: "invalid"; reason: "malformed" | "bad_signature" | "expired" | "not_found" | "withdrawn" }

export type CreditPreview = {
  creditId: string
  email: string
  projectId: string
  projectTitle: string | null
  projectSlug: string | null
  ownerCompanyName: string | null
  companyId: string | null
  companyName: string | null
  companyIsClaimed: boolean
  alreadyAccepted: boolean
}

/** Load what the acceptance page needs to show, without changing anything. */
export async function previewCredit(token: string | null | undefined): Promise<CreditPreview | { error: AcceptOutcome }> {
  const parsed = verifyAcceptToken(token)
  if (!parsed.ok) return { error: { status: "invalid", reason: parsed.reason } }

  const svc = createServiceRoleSupabaseClient()
  const { data: credit } = await svc
    .from("project_professionals")
    .select("id, project_id, company_id, invited_email, status, is_project_owner")
    .eq("id", parsed.creditId)
    .maybeSingle()

  if (!credit || credit.is_project_owner) return { error: { status: "invalid", reason: "not_found" } }
  // The address must still match the one the token was signed for: if an
  // owner re-pointed the credit at someone else, the old link is void.
  if ((credit.invited_email ?? "").trim().toLowerCase() !== parsed.email) {
    return { error: { status: "invalid", reason: "not_found" } }
  }
  if (credit.status === "removed" || credit.status === "rejected") {
    return { error: { status: "invalid", reason: "withdrawn" } }
  }

  const [{ data: project }, { data: company }, { data: ownerPP }] = await Promise.all([
    svc.from("projects").select("id, title, slug, status").eq("id", credit.project_id).maybeSingle(),
    credit.company_id
      ? svc.from("companies").select("id, name, owner_id").eq("id", credit.company_id).maybeSingle()
      : Promise.resolve({ data: null }),
    svc.from("project_professionals").select("company_id").eq("project_id", credit.project_id).eq("is_project_owner", true).maybeSingle(),
  ])

  if (!project || (project.status !== "published" && project.status !== "completed")) {
    return { error: { status: "invalid", reason: "not_found" } }
  }

  const { data: ownerCompany } = ownerPP?.company_id
    ? await svc.from("companies").select("name").eq("id", ownerPP.company_id).maybeSingle()
    : { data: null }

  return {
    creditId: credit.id,
    email: parsed.email,
    projectId: project.id,
    projectTitle: project.title ?? null,
    projectSlug: project.slug ?? null,
    ownerCompanyName: ownerCompany?.name ?? null,
    companyId: company?.id ?? null,
    companyName: company?.name ?? null,
    companyIsClaimed: Boolean(company?.owner_id),
    alreadyAccepted: credit.status === "live_on_page" || credit.status === "listed",
  }
}

/** Perform the acceptance. Only ever called from an explicit POST. */
export async function acceptCredit(token: string | null | undefined): Promise<AcceptOutcome> {
  const preview = await previewCredit(token)
  if ("error" in preview) return preview.error

  if (preview.alreadyAccepted) {
    return { status: "already_accepted", projectId: preview.projectId, projectSlug: preview.projectSlug }
  }

  // Claimed company: require a session that belongs to it.
  if (preview.companyIsClaimed && preview.companyId) {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { status: "needs_signin", email: preview.email }

    const svc = createServiceRoleSupabaseClient()
    const [{ data: owned }, { data: member }] = await Promise.all([
      svc.from("companies").select("id").eq("id", preview.companyId).eq("owner_id", user.id).maybeSingle(),
      svc.from("professionals").select("id").eq("company_id", preview.companyId).eq("user_id", user.id).maybeSingle(),
    ])
    if (!owned && !member) return { status: "wrong_account", email: preview.email }
  }

  const svc = createServiceRoleSupabaseClient()
  const { error } = await svc
    .from("project_professionals")
    .update({ status: "live_on_page", responded_at: new Date().toISOString() })
    .eq("id", preview.creditId)
  if (error) return { status: "invalid", reason: "not_found" }

  if (preview.companyId) {
    try {
      if (preview.companyIsClaimed) {
        // Claimed: a live credit lists the company page.
        const { syncCompanyListedStatus } = await import("@/lib/companies/sync-listed-status")
        await syncCompanyListedStatus(preview.companyId)
      } else {
        // Unclaimed: the credit goes live on the project page, but the
        // company page stays private until it is claimed. Mark it
        // 'invited' so Sales sees where it stands — the same guarded
        // transition promoteInvitedCompanyAction uses, so an 'unlisted'
        // or 'created' company is never overridden.
        const svc = createServiceRoleSupabaseClient()
        await svc
          .from("companies")
          .update({ status: "invited" })
          .eq("id", preview.companyId)
          .in("status", ["added", "prospected", "unclaimed"])
      }
    } catch (err) {
      // Non-fatal: the credit is accepted either way, but surface it —
      // swallowing this silently hid a broken import once already.
      console.error("company status update after accept failed", err)
    }
  }

  return {
    status: "accepted",
    projectId: preview.projectId,
    projectSlug: preview.projectSlug,
    companyId: preview.companyId,
  }
}
