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
}

export type ContactByEmailProspect = {
  id: string
  company_id: string | null
  company_name: string | null
  email: string
  contact_name: string | null
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
      "id, company_id, email, contact_name, status, sequence_status, emails_sent, source, created_at, next_follow_up_at, last_email_sent_at, user_id",
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
  if (primaryUserId) {
    const { data: p } = await svc
      .from("profiles")
      .select("id, first_name, last_name, phone, is_active")
      .eq("id", primaryUserId)
      .maybeSingle()
    profile = p ?? null
  }

  // company_contacts is only reachable via person_id, so a contact
  // without a signed-up account contributes no rows here. That's fine
  // for Phase 1 — the prospect record already carries the company link.
  let companyContactsRaw: Array<{ id: string; company_id: string; role: string; created_at: string | null }> = []
  if (primaryUserId) {
    const { data: cc } = await svc
      .from("company_contacts")
      .select("id, company_id, role, created_at")
      .eq("person_id", primaryUserId)
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
  if (companyIds.length > 0) {
    const { data: companies } = await svc
      .from("companies")
      .select("id, name")
      .in("id", companyIds)
    for (const c of companies ?? []) {
      if (c?.id && c?.name) companyNames.set(c.id, c.name)
    }
  }

  const prospects: ContactByEmailProspect[] = (prospectsRaw ?? []).map((p) => ({
    id: p.id,
    company_id: p.company_id,
    company_name: p.company_id ? companyNames.get(p.company_id) ?? null : null,
    email: p.email,
    contact_name: p.contact_name,
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
    data: { email, profile, prospects, companyContacts },
  }
}
