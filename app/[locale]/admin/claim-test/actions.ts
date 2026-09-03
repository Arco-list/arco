"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { issueClaimToken, type ClaimChannel } from "@/lib/claim/claim-token"

/**
 * Test harness for the /claim funnels. Admin-gated by the /admin layout.
 *
 * Tokens are single-use, so walking a funnel repeatedly means minting a
 * fresh link each time — that is what mint does. Completing the commit
 * additionally creates an account and claims the company; reset puts
 * the designated FIXTURE company (Olli) back to virgin state so the
 * codeless happy path can be walked again. Reset refuses every other
 * company: it deletes accounts, and only the fixture's are test data.
 */

const FIXTURE_COMPANY_ID = "c0c0c629-2983-4658-b834-c5dafe6bc7f3" // Olli
const FIXTURE_EMAIL_DOMAIN = "askolli.com"

export async function mintClaimTestLinkAction(input: {
  companyId: string
  channel: ClaimChannel
  /** Override recipient; defaults to the pending credit's address
   *  (invite) or companies.email (other channels). */
  email?: string
}): Promise<{ ok: true; token: string; email: string; channel: ClaimChannel } | { ok: false; error: string }> {
  const svc = createServiceRoleSupabaseClient()

  const { data: company } = await svc
    .from("companies")
    .select("id, name, email, owner_id")
    .eq("id", input.companyId)
    .maybeSingle()
  if (!company) return { ok: false, error: "Bedrijf niet gevonden." }
  if (company.owner_id) return { ok: false, error: "Bedrijf is al geclaimd — de claimpagina weigert dan." }

  let creditId: string | null = null
  let email = input.email?.trim().toLowerCase() ?? ""

  if (input.channel === "invite") {
    // Invite rides on a pending credit; pick the newest addressable one.
    const { data: credit } = await svc
      .from("project_professionals")
      .select("id, invited_email, projects!inner(status)")
      .eq("company_id", input.companyId)
      .eq("is_project_owner", false)
      .eq("status", "invited")
      .not("invited_email", "is", null)
      .in("projects.status", ["published", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!credit) return { ok: false, error: "Geen openstaande credit op een gepubliceerd project — invite-kanaal heeft er een nodig." }
    creditId = credit.id
    if (!email) email = (credit.invited_email as string).toLowerCase()
  }

  if (!email) email = (company.email ?? "").toLowerCase()
  if (!email) return { ok: false, error: "Geen e-mailadres: bedrijf heeft geen companies.email — geef er zelf een op." }

  const { token } = await issueClaimToken({
    companyId: input.companyId,
    creditId,
    email,
    channel: input.channel,
  })
  return { ok: true, token, email, channel: input.channel }
}

export async function resetClaimFixtureAction(): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  const svc = createServiceRoleSupabaseClient()

  // Everything below deletes accounts — locked to the fixture.
  const companyId = FIXTURE_COMPANY_ID

  const { data: users } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const fixtureUsers = (users?.users ?? []).filter(
    (u) => u.email?.toLowerCase().endsWith(`@${FIXTURE_EMAIL_DOMAIN}`),
  )

  let removed = 0
  for (const u of fixtureUsers) {
    await svc.from("prospects").update({ user_id: null, signed_up_at: null }).eq("user_id", u.id)
    await svc.from("professionals").delete().eq("user_id", u.id)
    await svc.from("persons").update({ auth_user_id: null }).eq("auth_user_id", u.id)
    await svc.from("profiles").delete().eq("id", u.id)
    const { error } = await svc.auth.admin.deleteUser(u.id)
    if (!error) removed++
  }

  // Company back to unclaimed; credits on it back to invited.
  await svc
    .from("companies")
    .update({ owner_id: null, status: "invited", audience: "homeowner" })
    .eq("id", companyId)
  const { data: credits } = await svc
    .from("project_professionals")
    .update({ status: "invited", responded_at: null })
    .eq("company_id", companyId)
    .eq("is_project_owner", false)
    .in("status", ["live_on_page", "listed"])
    .select("id")
  // Spent tokens are useless anyway; clear them for hygiene.
  await svc.from("claim_tokens" as never).delete().eq("company_id", companyId)

  return {
    ok: true,
    summary: `${removed} account(s) verwijderd, ${credits?.length ?? 0} credit(s) teruggezet, bedrijf unclaimed, tokens opgeruimd.`,
  }
}
