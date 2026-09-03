"use server"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { verifyClaimToken, consumeClaimToken, releaseClaimToken } from "@/lib/claim/claim-token"
import { ensureCompanyOwnerContact } from "@/lib/company-ownership"
import { syncCompanyListedStatus } from "@/lib/companies/sync-listed-status"
import { logger } from "@/lib/logger"

/**
 * Server actions for the /claim funnel (new company signup flow, built
 * next to the modal-based one — nothing links here until go-live).
 *
 * The ratchet: the Company step WRITES (so an abandoner still leaves us
 * a corrected, contactable company record), the You step creates the
 * account, publishing sets Listed. Nothing on this path creates an
 * account as a side effect of opening a link.
 */

/** A Places-resolved location. The only way location data enters this
 *  flow — free text never reaches companies.address. */
export type ClaimLocationInput = {
  formattedAddress: string
  city: string | null
  stateRegion: string | null
  country: string | null
  placeId: string
  latitude: number | null
  longitude: number | null
}

type CompanyStepInput = {
  token: string
  name: string
  /** Present only when the recipient re-picked the address. */
  location: ClaimLocationInput | null
  primaryServiceId: string | null
  serviceIds: string[]
}

export async function saveCompanyStepAction(
  input: CompanyStepInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = await verifyClaimToken(input.token)
  if (!parsed.ok) return { ok: false, error: `invalid token (${parsed.reason})` }
  if (parsed.consumed) return { ok: false, error: "This link has already been used." }

  const svc = createServiceRoleSupabaseClient()
  const { data: company } = await svc
    .from("companies")
    .select("id, domain, owner_id, status, address")
    .eq("id", parsed.companyId)
    .maybeSingle()
  if (!company) return { ok: false, error: "Company not found." }
  // A claimed company cannot be edited through a claim link.
  if (company.owner_id) return { ok: false, error: "This company has already been claimed." }

  const name = input.name.trim()
  if (!name) return { ok: false, error: "Company name is required." }
  // Address and primary service are required to continue: the page that
  // goes live must be filterable (city/region) and classifiable (trade).
  if (!input.primaryServiceId) return { ok: false, error: "Select at least one service." }
  if (!input.location && !company.address) return { ok: false, error: "An office location is required." }

  // companies.email is deliberately NOT touched here. Post-claim, all
  // communication goes to the Arco account's own address; the company
  // row's email is ops data (where the invite was sent). The claim asks
  // for an address only where one is needed as proof — never as a
  // contact field to curate.
  const { error } = await svc
    .from("companies")
    .update({
      name,
      primary_service_id: input.primaryServiceId,
      services_offered: input.serviceIds.length ? input.serviceIds : null,
      // Location only moves when a Places pick supplied the full record;
      // untouched means the imported values stay as they are.
      ...(input.location
        ? {
            address: input.location.formattedAddress,
            city: input.location.city,
            state_region: input.location.stateRegion,
            country: input.location.country,
            google_place_id: input.location.placeId,
            latitude: input.location.latitude,
            longitude: input.location.longitude,
          }
        : {}),
    })
    .eq("id", parsed.companyId)
    .is("owner_id", null)
  if (error) {
    logger.error("claim: company step save failed", { companyId: parsed.companyId }, error as unknown as Error)
    return { ok: false, error: "Could not save. Please try again." }
  }
  return { ok: true }
}

/** Shared core: link a user to the company, retire the credit, sync
 *  Listed. Used by both the kept-address and signed-in paths. */
async function claimCompanyForUser(params: {
  userId: string
  companyId: string
  creditId: string | null
  primaryServiceId?: string | null
}): Promise<{ ok: true; slug: string | null } | { ok: false; error: string }> {
  const svc = createServiceRoleSupabaseClient()

  const { data: company } = await svc
    .from("companies")
    .select("id, name, slug, owner_id, primary_service_id")
    .eq("id", params.companyId)
    .maybeSingle()
  if (!company) return { ok: false, error: "Company not found." }
  if (company.owner_id && company.owner_id !== params.userId) {
    return { ok: false, error: "This company has already been claimed by someone else." }
  }

  // Owner — guarded so a concurrent claim cannot steal it.
  if (!company.owner_id) {
    const { data: claimed } = await svc
      .from("companies")
      .update({ owner_id: params.userId })
      .eq("id", params.companyId)
      .is("owner_id", null)
      .select("id")
    if (!claimed?.length) return { ok: false, error: "This company was just claimed by someone else." }
  }

  // Professional link — mirrors autoCreateCompanyFromDomain.
  const servicesOffered = params.primaryServiceId ?? company.primary_service_id
  const { data: existingPro } = await svc
    .from("professionals")
    .select("id")
    .eq("user_id", params.userId)
    .maybeSingle()
  if (existingPro) {
    await svc.from("professionals")
      .update({ company_id: params.companyId, title: company.name ?? "", services_offered: servicesOffered ? [servicesOffered] : null })
      .eq("id", existingPro.id)
  } else {
    await svc.from("professionals").insert({
      title: company.name ?? "",
      user_id: params.userId,
      company_id: params.companyId,
      services_offered: servicesOffered ? [servicesOffered] : null,
    })
  }

  // Profile promotion.
  const { data: profile } = await svc.from("profiles").select("user_types").eq("id", params.userId).maybeSingle()
  const types = Array.isArray(profile?.user_types) ? profile!.user_types : []
  if (!types.includes("professional")) {
    await svc.from("profiles").update({ user_types: [...types, "professional"] }).eq("id", params.userId)
  }
  await ensureCompanyOwnerContact(svc, params.companyId, params.userId)

  // The credit that carried the invite goes live on the project page.
  if (params.creditId) {
    await svc.from("project_professionals")
      .update({ status: "live_on_page", responded_at: new Date().toISOString() })
      .eq("id", params.creditId)
      .neq("status", "live_on_page")
  }

  // Listed at Live: a claimed company with a live credit on a published
  // project lists itself — same helper the accept flow uses.
  try { await syncCompanyListedStatus(params.companyId) } catch (err) {
    console.error("claim: listed sync failed", err)
  }
  return { ok: true, slug: company.slug ?? null }
}

type CompleteInput = { token: string; firstName: string; lastName?: string }
export type CompleteClaimResult =
  | { status: "done"; loginUrl: string }
  | { status: "existing_account"; email: string }
  | { status: "error"; error: string }

/**
 * The commit, for the common case: sign in with the invited address.
 * Possession of that mailbox was proven by delivery, so no code —
 * account created, company claimed, session minted via the same
 * generateLink → /auth/callback?token_hash path admin login-as uses.
 */
export async function completeClaimAction(input: CompleteInput): Promise<CompleteClaimResult> {
  const parsed = await verifyClaimToken(input.token)
  if (!parsed.ok) return { status: "error", error: `invalid token (${parsed.reason})` }
  if (parsed.consumed) return { status: "error", error: "This link has already been used." }
  const firstName = input.firstName.trim()
  if (!firstName) return { status: "error", error: "Please tell us your name." }

  const svc = createServiceRoleSupabaseClient()

  // Existing account? Checked BEFORE consuming, so the token survives a
  // sign-in round trip and finalizeClaimSignedInAction can finish it.
  const { data: userList } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = (userList?.users ?? []).find(
    (u) => u.email?.toLowerCase() === parsed.email.toLowerCase(),
  )
  if (existing) return { status: "existing_account", email: parsed.email }

  // Claim-before-act: whoever consumes the token owns the commit.
  if (!(await consumeClaimToken(parsed.id))) {
    return { status: "error", error: "This link has already been used." }
  }

  let userId: string | null = null
  try {
    const { data: created, error: createError } = await svc.auth.admin.createUser({
      email: parsed.email,
      email_confirm: true, // delivery of the claim link already proved the mailbox
      user_metadata: {
        first_name: firstName,
        last_name: input.lastName?.trim() || null,
        user_type: "professional",
      },
    })
    if (createError || !created?.user) throw createError ?? new Error("createUser returned nothing")
    userId = created.user.id

    const claimed = await claimCompanyForUser({
      userId,
      companyId: parsed.companyId,
      creditId: parsed.creditId,
    })
    if (!claimed.ok) throw new Error(claimed.error)

    // Mint the session: silent magiclink, verified by /auth/callback.
    const { data: linkData, error: linkError } = await svc.auth.admin.generateLink({
      type: "magiclink",
      email: parsed.email,
    })
    const actionLink = linkData?.properties?.action_link
    const tokenHash = actionLink
      ? new URL(actionLink).searchParams.get("token") ?? linkData?.properties?.hashed_token
      : linkData?.properties?.hashed_token
    if (linkError || !tokenHash) throw linkError ?? new Error("no token_hash from generateLink")

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const loginUrl = new URL(`${siteUrl}/auth/callback`)
    loginUrl.searchParams.set("token_hash", tokenHash)
    loginUrl.searchParams.set("type", "magiclink")
    // Land in company edit, not on the public page: it opens with the
    // live status label, the first-run tour for a brand-new owner, a
    // preview of the page, and Add project one click away.
    loginUrl.searchParams.set(
      "redirect_to",
      `/dashboard/company?company_id=${parsed.companyId}&claimed=1`,
    )
    return { status: "done", loginUrl: loginUrl.toString() }
  } catch (err) {
    // Failed after consumption: hand the token back so the link retries,
    // and remove a half-created account rather than stranding a ghost.
    logger.error("claim: complete failed", { companyId: parsed.companyId }, err as Error)
    await releaseClaimToken(parsed.id)
    if (userId) {
      try {
        await svc.from("profiles").delete().eq("id", userId)
        await svc.auth.admin.deleteUser(userId)
      } catch { /* non-fatal */ }
    }
    return { status: "error", error: "Something went wrong publishing your page. The link still works — try again." }
  }
}

/**
 * The commit for the proven address when an account already EXISTS
 * there. The token proved the mailbox (delivery on the e-mail
 * channels, the step-1 code on platform), which is exactly what a
 * sign-in code would prove again — so no second code: claim for the
 * existing user and mint their session the same way the codeless
 * account creation does.
 */
export async function completeClaimExistingAction(
  token: string,
): Promise<{ status: "done"; loginUrl: string } | { status: "no_account" } | { status: "error"; error: string }> {
  const parsed = await verifyClaimToken(token)
  if (!parsed.ok) return { status: "error", error: `invalid token (${parsed.reason})` }
  if (parsed.consumed) return { status: "error", error: "This link has already been used." }

  const svc = createServiceRoleSupabaseClient()
  const { data: userList } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = (userList?.users ?? []).find(
    (u) => u.email?.toLowerCase() === parsed.email.toLowerCase(),
  )
  // Account gone between check and commit — the caller falls back to
  // the normal sign-in-code flow.
  if (!existing) return { status: "no_account" }

  if (!(await consumeClaimToken(parsed.id))) {
    return { status: "error", error: "This link has already been used." }
  }
  try {
    const claimed = await claimCompanyForUser({
      userId: existing.id,
      companyId: parsed.companyId,
      creditId: parsed.creditId,
    })
    if (!claimed.ok) throw new Error(claimed.error)

    const { data: linkData, error: linkError } = await svc.auth.admin.generateLink({
      type: "magiclink",
      email: parsed.email,
    })
    const actionLink = linkData?.properties?.action_link
    const tokenHash = actionLink
      ? new URL(actionLink).searchParams.get("token") ?? linkData?.properties?.hashed_token
      : linkData?.properties?.hashed_token
    if (linkError || !tokenHash) throw linkError ?? new Error("no token_hash from generateLink")

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const loginUrl = new URL(`${siteUrl}/auth/callback`)
    loginUrl.searchParams.set("token_hash", tokenHash)
    loginUrl.searchParams.set("type", "magiclink")
    loginUrl.searchParams.set(
      "redirect_to",
      `/dashboard/company?company_id=${parsed.companyId}&claimed=1`,
    )
    return { status: "done", loginUrl: loginUrl.toString() }
  } catch (err) {
    logger.error("claim: existing-account complete failed", { companyId: parsed.companyId }, err as Error)
    await releaseClaimToken(parsed.id)
    return { status: "error", error: "Something went wrong publishing your page. The link still works — try again." }
  }
}

/**
 * The commit for a caller who already holds a session: the swap-address
 * path (they verified a different login with a one-time code) and the
 * existing-account path. The claim token authorises the company; the
 * session authorises the person.
 */
export async function finalizeClaimSignedInAction(
  token: string,
): Promise<{ status: "done"; redirectTo: string } | { status: "error"; error: string }> {
  const parsed = await verifyClaimToken(token)
  if (!parsed.ok) return { status: "error", error: `invalid token (${parsed.reason})` }
  if (parsed.consumed) return { status: "error", error: "This link has already been used." }

  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "error", error: "You must be signed in." }

  if (!(await consumeClaimToken(parsed.id))) {
    return { status: "error", error: "This link has already been used." }
  }
  const claimed = await claimCompanyForUser({
    userId: user.id,
    companyId: parsed.companyId,
    creditId: parsed.creditId,
  })
  if (!claimed.ok) {
    await releaseClaimToken(parsed.id)
    return { status: "error", error: claimed.error }
  }
  return {
    status: "done",
    redirectTo: `/dashboard/company?company_id=${parsed.companyId}&claimed=1`,
  }
}
