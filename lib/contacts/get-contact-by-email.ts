"use server"

import {
  createServerActionSupabaseClient,
  createServiceRoleSupabaseClient,
} from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"

/**
 * Phase 1 discovery layer for the shared Contact Card slide-over.
 *
 * Keyed by normalized email. Returns every prospect, company_contact,
 * and profile row that plausibly represents the same person. The card
 * consumer chooses how to render — this helper deliberately does not
 * merge / dedupe / pick a "primary" record. Front-end concern.
 *
 * Discovery model:
 *   - prospects.email  → direct email match (all sources: arco, apollo, invites)
 *   - profiles         → hydrated from the first prospect that has user_id
 *   - company_contacts → filtered by person_id (that same user_id)
 *
 * Known Phase 1 limitation: a signed-up user whose auth.users.email
 * doesn't match ANY prospect row is currently invisible to this helper.
 * Phase 2 adds an auth.users lookup as a fallback discovery path.
 */

export type ContactByEmailProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  is_active: boolean | null
  user_types: string[] | null
  admin_role: string | null
}

export type ContactByEmailCompanySummary = {
  id: string
  name: string
  slug: string | null
  logo_url: string | null
  city: string | null
  domain: string | null
  primary_service_name: string | null
}

export type ContactByEmailProspect = {
  id: string
  company_id: string | null
  company_name: string | null
  email: string
  contact_name: string | null
  phone: string | null
  status: string
  sequence_status: string | null
  emails_sent: number | null
  source: string | null
  created_at: string | null
  next_follow_up_at: string | null
  last_email_sent_at: string | null
  user_id: string | null
}

export type ContactByEmailCompanyContact = {
  id: string
  company_id: string
  company_name: string | null
  role: string
  created_at: string | null
}

export type ContactByEmailData = {
  email: string
  profile: ContactByEmailProfile | null
  prospects: ContactByEmailProspect[]
  companyContacts: ContactByEmailCompanyContact[]
  /** Enriched summary (logo, city, primary service) keyed by company_id.
   *  Powers the Companies-section rendering — front-end joins by id. */
  companiesById: Record<string, ContactByEmailCompanySummary>
}

export type ContactByEmailResult =
  | { success: true; data: ContactByEmailData }
  | { success: false; error: string }

export async function getContactByEmail(rawEmail: string): Promise<ContactByEmailResult> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", user.id)
    .maybeSingle()

  if (!isAdminUser(viewerProfile?.user_types, viewerProfile?.admin_role)) {
    return { success: false, error: "Not authorized" }
  }

  const email = rawEmail.trim().toLowerCase()
  if (!email) return { success: false, error: "email required" }

  const svc = createServiceRoleSupabaseClient()

  // Prospects — case-insensitive so a manually-entered link with a
  // capital in the address still matches the row imported from Apollo.
  const { data: prospectsRaw, error: prospectsErr } = await svc
    .from("prospects")
    .select(
      "id, company_id, email, contact_name, phone, status, sequence_status, emails_sent, source, created_at, next_follow_up_at, last_email_sent_at, user_id",
    )
    .ilike("email", email)

  if (prospectsErr) return { success: false, error: prospectsErr.message }

  // Any prospect that already linked to a signed-up user tells us the
  // profile id. Multiple prospects for the same email should point at
  // the same user; if they diverge we take the first — Phase 2 merges.
  const userIds = Array.from(
    new Set(
      (prospectsRaw ?? [])
        .map((p) => p.user_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  )
  const primaryUserId = userIds[0] ?? null

  let profile: ContactByEmailProfile | null = null
  let resolvedUserId = primaryUserId
  if (resolvedUserId) {
    const { data: p } = await svc
      .from("profiles")
      .select("id, first_name, last_name, phone, is_active, user_types, admin_role")
      .eq("id", resolvedUserId)
      .maybeSingle()
    profile = p ?? null
  }

  // Fallback discovery: when no prospect row linked us to a user_id,
  // look the profile up via auth.users.email → profiles (migration 197).
  // This is what makes the card on /admin/users useful for architects
  // and professionals who signed up directly without ever being an
  // outreach target.
  if (!profile) {
    // svc.rpc cast because lib/supabase/types.ts hasn't been
    // regenerated for the new function yet; the RPC exists in the DB
    // via migration 197. Row shape mirrors the RPC's RETURNS TABLE.
    type ProfileByEmailRow = {
      id: string
      first_name: string | null
      last_name: string | null
      phone: string | null
      is_active: boolean | null
      user_types: string[] | null
      admin_role: string | null
    }
    const { data: rpcRows } = await (svc.rpc as unknown as (
      fn: string,
      params: { p_email: string },
    ) => Promise<{ data: ProfileByEmailRow[] | null }>)("get_profile_by_email", { p_email: email })
    const row = rpcRows?.[0] ?? null
    if (row?.id) {
      resolvedUserId = row.id
      profile = {
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        phone: row.phone,
        is_active: row.is_active,
        user_types: row.user_types,
        admin_role: row.admin_role,
      }
    }
  }

  // company_contacts via person_id — now reachable for the fallback
  // path too, because we've resolved a user_id from the profile lookup.
  let companyContactsRaw: Array<{ id: string; company_id: string; role: string; created_at: string | null }> = []
  if (resolvedUserId) {
    const { data: cc } = await svc
      .from("company_contacts")
      .select("id, company_id, role, created_at")
      .eq("person_id", resolvedUserId)
    companyContactsRaw = (cc ?? []) as typeof companyContactsRaw
  }

  // One trip for company names covering both prospect + company_contact
  // company_ids.
  const companyIds = Array.from(
    new Set([
      ...(prospectsRaw ?? [])
        .map((p) => p.company_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
      ...companyContactsRaw
        .map((c) => c.company_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ]),
  )

  const companyNames = new Map<string, string>()
  const companiesById: Record<string, ContactByEmailCompanySummary> = {}
  if (companyIds.length > 0) {
    const { data: companies } = await svc
      .from("companies")
      .select("id, name, slug, logo_url, city, domain, primary_service:categories!companies_primary_service_id_fkey(name)")
      .in("id", companyIds)
    for (const c of (companies ?? []) as Array<{
      id: string
      name: string | null
      slug: string | null
      logo_url: string | null
      city: string | null
      domain: string | null
      primary_service: { name: string | null } | null
    }>) {
      if (!c?.id) continue
      const name = c.name ?? "(unnamed company)"
      companyNames.set(c.id, name)
      companiesById[c.id] = {
        id: c.id,
        name,
        slug: c.slug ?? null,
        logo_url: c.logo_url ?? null,
        city: c.city ?? null,
        domain: c.domain ?? null,
        primary_service_name: c.primary_service?.name ?? null,
      }
    }
  }

  const prospects: ContactByEmailProspect[] = (prospectsRaw ?? []).map((p) => ({
    id: p.id,
    company_id: p.company_id,
    company_name: p.company_id ? companyNames.get(p.company_id) ?? null : null,
    email: p.email,
    contact_name: p.contact_name,
    phone: (p as { phone?: string | null }).phone ?? null,
    status: p.status,
    sequence_status: p.sequence_status,
    emails_sent: p.emails_sent,
    source: p.source,
    created_at: p.created_at,
    next_follow_up_at: p.next_follow_up_at,
    last_email_sent_at: p.last_email_sent_at,
    user_id: p.user_id,
  }))

  const companyContacts: ContactByEmailCompanyContact[] = companyContactsRaw.map((c) => ({
    id: c.id,
    company_id: c.company_id,
    company_name: companyNames.get(c.company_id) ?? null,
    role: c.role,
    created_at: c.created_at,
  }))

  return {
    success: true,
    data: { email, profile, prospects, companyContacts, companiesById },
  }
}
