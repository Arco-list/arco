"use server"

import {
  createServerActionSupabaseClient,
  createServiceRoleSupabaseClient,
} from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"

/**
 * In-field edit target for the shared Contact Card (Phase 2b of the
 * card work). Writes name / phone straight to the linked profiles row.
 *
 * Authority for now is `profiles` only — the RPC from migration 197
 * finds the row via auth.users.email. If no signed-up account exists
 * for the email, the write is a no-op and returns success:false with
 * `noProfileLinked` so the card can render a graceful "can't edit yet"
 * hint. The prospect-only editing path (writing to prospects.contact_name)
 * is a follow-up — this covers every /admin/users contact and every
 * /admin/sales contact whose company owner has claimed.
 *
 * Email + role + source stay read-only:
 *   - Email: managed by auth.users, changing it needs a re-verification
 *     flow we haven't decided on.
 *   - Role / user-type: derived from user_types + admin_role +
 *     company_contacts.role; a single free-text edit here would clobber
 *     three sources.
 *   - Source: prospects.source, immutable audit trail.
 */

export type UpdateProfileByEmailInput = {
  email: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
}

export type UpdateProfileByEmailResult =
  | { success: true }
  | { success: false; error: string; noProfileLinked?: boolean }

export async function updateProfileByEmail(
  input: UpdateProfileByEmailInput,
): Promise<UpdateProfileByEmailResult> {
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

  const email = input.email.trim().toLowerCase()
  if (!email) return { success: false, error: "email required" }

  const patch: Record<string, unknown> = {}
  if (input.first_name !== undefined) patch.first_name = input.first_name
  if (input.last_name !== undefined) patch.last_name = input.last_name
  if (input.phone !== undefined) patch.phone = input.phone
  if (Object.keys(patch).length === 0) return { success: true }

  // Resolve target profile via the same RPC the read path uses. Cast
  // because lib/supabase/types.ts hasn't been regenerated for the new
  // function yet — mirror of the cast in get-contact-by-email.ts.
  const svc = createServiceRoleSupabaseClient()
  type ProfileByEmailRow = { id: string }
  const { data: rpcRows } = await (svc.rpc as unknown as (
    fn: string,
    params: { p_email: string },
  ) => Promise<{ data: ProfileByEmailRow[] | null }>)("get_profile_by_email", { p_email: email })
  const row = rpcRows?.[0] ?? null
  if (!row?.id) {
    return { success: false, error: "No signed-up account for this email", noProfileLinked: true }
  }

  const { error: updateError } = await svc
    .from("profiles")
    .update(patch as { first_name?: string | null; last_name?: string | null; phone?: string | null })
    .eq("id", row.id)
  if (updateError) return { success: false, error: updateError.message }

  return { success: true }
}
