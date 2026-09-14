import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

export type CompanyEmailRecipient = {
  email: string
  /** auth user id when the contact has signed up — lets the mailer
   *  resolve preferred_language per recipient. */
  userId: string | null
}

/**
 * Who receives company transactional mail (introduction request,
 * project live/rejected) for a company.
 *
 * Source of truth is company_contacts.receives_company_email — the
 * toggle on the dashboard Team page. Admins/owners default on, and the
 * team actions enforce that at least one contact stays on. The owner
 * fallback below is a safety net for companies predating the toggle or
 * with no team rows at all: company mail must never silently stop.
 */
export async function getCompanyEmailRecipients(
  companyId: string,
): Promise<CompanyEmailRecipient[]> {
  const supabase = createServiceRoleSupabaseClient()

  const { data: contacts } = await supabase
    .from("company_contacts")
    .select("receives_company_email, status, person:persons!inner(email, auth_user_id)")
    .eq("company_id", companyId)
    .in("role", ["owner", "admin", "member"])
    .eq("receives_company_email", true)

  const seen = new Set<string>()
  const recipients: CompanyEmailRecipient[] = []
  for (const row of contacts ?? []) {
    if ((row as any).status && (row as any).status !== "active") continue
    const person = (row as any).person as { email: string | null; auth_user_id: string | null } | null
    const email = person?.email?.trim().toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)
    recipients.push({ email, userId: person?.auth_user_id ?? null })
  }
  if (recipients.length > 0) return recipients

  // Fallback: the owner's auth email, then the company contact address.
  const { data: company } = await supabase
    .from("companies")
    .select("owner_id, email")
    .eq("id", companyId)
    .maybeSingle()
  if (company?.owner_id) {
    const { data: owner } = await supabase.auth.admin.getUserById(company.owner_id)
    const email = owner?.user?.email?.trim().toLowerCase()
    if (email) return [{ email, userId: company.owner_id }]
  }
  const companyEmail = company?.email?.trim().toLowerCase()
  return companyEmail ? [{ email: companyEmail, userId: null }] : []
}
