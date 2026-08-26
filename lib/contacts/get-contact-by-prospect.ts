"use server"

import {
  createServerActionSupabaseClient,
  createServiceRoleSupabaseClient,
} from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { getContactByEmail, type ContactByEmailResult } from "@/lib/contacts/get-contact-by-email"

/**
 * Prospect-keyed variant of getContactByEmail.
 *
 * Used when a Sales row has no email yet (e.g. Duin Interior's
 * Showcase prospect was inserted with an empty email placeholder —
 * migration 195 partial-unique index allows multiples). Row click
 * needs to open the Contact Card so the rep can add the address in
 * place. We can't key on email (empty), so key on prospect id.
 *
 * If the prospect already has a non-empty email we defer to
 * getContactByEmail with that email — same discovery layer, no
 * duplication.
 *
 * For prospects with an empty email we synthesize a minimal
 * ContactByEmailResult so the card renders: prospects[0] holds the
 * one row, companiesById carries the linked company, everything
 * else is empty.
 */

export async function getContactByProspectId(id: string): Promise<ContactByEmailResult> {
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

  const trimmed = id.trim()
  if (!trimmed) return { success: false, error: "prospect id required" }

  const svc = createServiceRoleSupabaseClient()
  const { data: prospect, error } = await svc
    .from("prospects")
    .select(
      "id, company_id, email, contact_name, phone, status, sequence_status, emails_sent, source, created_at, next_follow_up_at, last_email_sent_at, user_id, not_interested_at",
    )
    .eq("id", trimmed)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!prospect) return { success: false, error: "Prospect not found" }

  // If a real email is on the prospect, hand off to the email path —
  // fetches profile, other prospects, aliases, etc.
  if (prospect.email && prospect.email.trim().length > 0) {
    return getContactByEmail(prospect.email)
  }

  // Empty-email path: synthesize the minimal payload the card needs.
  // The rep will fill the email in place; on save the URL swaps from
  // prospect:<id> to the new email and the card re-hydrates via the
  // full discovery layer.
  const companyId = prospect.company_id
  const companiesById: NonNullable<Extract<ContactByEmailResult, { success: true }>["data"]>["companiesById"] = {}
  if (companyId) {
    const { data: c } = await svc
      .from("companies")
      .select("id, name, slug, logo_url, city, domain, website, status, primary_service:categories!companies_primary_service_id_fkey(name)")
      .eq("id", companyId)
      .maybeSingle()
    const row = c as unknown as {
      id: string
      name: string | null
      slug: string | null
      logo_url: string | null
      city: string | null
      domain: string | null
      website: string | null
      status: string | null
      primary_service: { name: string | null } | null
    } | null
    if (row?.id) {
      companiesById[row.id] = {
        id: row.id,
        name: row.name ?? "(unnamed company)",
        slug: row.slug ?? null,
        logo_url: row.logo_url ?? null,
        city: row.city ?? null,
        domain: row.domain ?? null,
        website: row.website ?? null,
        status: row.status ?? null,
        primary_service_name: row.primary_service?.name ?? null,
      }
    }
  }

  return {
    success: true,
    data: {
      email: "",
      profile: null,
      prospects: [{
        id: prospect.id,
        company_id: prospect.company_id,
        company_name: companyId ? companiesById[companyId]?.name ?? null : null,
        email: prospect.email ?? "",
        contact_name: prospect.contact_name,
        phone: (prospect as { phone?: string | null }).phone ?? null,
        status: prospect.status,
        sequence_status: prospect.sequence_status,
        emails_sent: prospect.emails_sent,
        source: prospect.source,
        created_at: prospect.created_at,
        next_follow_up_at: prospect.next_follow_up_at,
        last_email_sent_at: prospect.last_email_sent_at,
        user_id: prospect.user_id,
        not_interested_at: (prospect as { not_interested_at?: string | null }).not_interested_at ?? null,
      }],
      companyContacts: [],
      memberships: [],
      companiesById,
      aliases: [],
    },
  }
}
