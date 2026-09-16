import "server-only"

import { logger } from "@/lib/logger"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

const TEAM_ROLES: ("owner" | "admin" | "member")[] = ["owner", "admin", "member"]

/**
 * Guarantee that at least one team member receives company mail.
 *
 * The toggle's own guard refuses to switch off the last receiver, but
 * that only protects companies that had one to begin with. A company
 * can reach zero by other routes: contacts created before the flag
 * existed, the sole receiver being removed or deactivated, or an owner
 * transfer. Company mail still arrives — the recipient resolver falls
 * back to the owner's auth e-mail — but the team page then shows every
 * switch off, which reads as "nobody gets this" and is a lie.
 *
 * So this repairs the state instead: the owner's own contact is
 * switched on, or failing that the oldest active team contact. Cheap
 * and idempotent — one count, and a write only when actually broken.
 */
export async function ensureCompanyEmailReceiver(companyId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient()

  const { count } = await supabase
    .from("company_contacts")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "active")
    .eq("receives_company_email", true)
    .in("role", TEAM_ROLES)

  if ((count ?? 0) > 0) return

  const { data: company } = await supabase
    .from("companies")
    .select("owner_id")
    .eq("id", companyId)
    .maybeSingle()

  // Prefer the owner: they are the one person who cannot leave the
  // company without transferring it, so the mail keeps a home.
  const ownerId = (company as { owner_id?: string | null } | null)?.owner_id ?? null
  let targetId: string | null = null

  if (ownerId) {
    const { data: ownerContact } = await supabase
      .from("company_contacts")
      .select("id, person:persons!inner(auth_user_id)")
      .eq("company_id", companyId)
      .eq("status", "active")
      .eq("person.auth_user_id", ownerId)
      .in("role", TEAM_ROLES)
      .limit(1)
      .maybeSingle()
    targetId = (ownerContact as { id?: string } | null)?.id ?? null
  }

  if (!targetId) {
    const { data: oldest } = await supabase
      .from("company_contacts")
      .select("id")
      .eq("company_id", companyId)
      .eq("status", "active")
      .in("role", TEAM_ROLES)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
    targetId = (oldest as { id?: string } | null)?.id ?? null
  }

  // A company with no active team contacts at all is a different
  // problem; there is nobody to switch on and nothing to repair here.
  if (!targetId) return

  const { error } = await supabase
    .from("company_contacts")
    .update({ receives_company_email: true } as never)
    .eq("id", targetId)

  if (error) {
    logger.error("Failed to restore a company-email receiver", { companyId, contactId: targetId, error: error.message })
    return
  }
  logger.info("Restored a company-email receiver", { companyId, contactId: targetId })
}
