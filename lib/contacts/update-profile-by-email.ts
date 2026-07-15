"use server"

import {
  createServerActionSupabaseClient,
  createServiceRoleSupabaseClient,
} from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"

/**
 * In-field edit target for the shared Contact Card.
 *
 * Write authority:
 *   1. If the email is linked to a signed-up account (get_profile_by_email
 *      RPC hits), write to profiles.first_name / last_name / phone. This
 *      is the canonical record for anyone who's ever logged in.
 *   2. Otherwise, write to the first matching prospects row —
 *      contact_name (single field, not split) and phone. Covers every
 *      Sales-only contact who never went through signup.
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
  /** Full display name — split on first whitespace when writing to
   *  profiles (first + last), stored verbatim as contact_name when
   *  writing to prospects. Pass undefined to leave unchanged. */
  full_name?: string | null
  /** Kept for callers that still send first/last explicitly. When
   *  full_name is provided it wins. */
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
}

export type UpdateProfileByEmailResult =
  | { success: true; target: "profile" | "prospect" }
  | { success: false; error: string }

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

  const svc = createServiceRoleSupabaseClient()

  // Step 1: try the profile path via the RPC from migration 197.
  type ProfileByEmailRow = { id: string }
  const { data: rpcRows } = await (svc.rpc as unknown as (
    fn: string,
    params: { p_email: string },
  ) => Promise<{ data: ProfileByEmailRow[] | null }>)("get_profile_by_email", { p_email: email })
  const profileRow = rpcRows?.[0] ?? null

  if (profileRow?.id) {
    // Split full_name on first whitespace: first token -> first_name,
    // rest -> last_name. Callers can override by sending first/last
    // directly.
    let firstName = input.first_name
    let lastName = input.last_name
    if (input.full_name !== undefined && input.full_name !== null) {
      const trimmed = input.full_name.trim()
      const parts = trimmed ? trimmed.split(/\s+/) : []
      firstName = parts.shift() ?? ""
      lastName = parts.join(" ") || null
    } else if (input.full_name === null) {
      firstName = null
      lastName = null
    }

    const patch: Record<string, unknown> = {}
    if (firstName !== undefined) patch.first_name = firstName
    if (lastName !== undefined) patch.last_name = lastName
    if (input.phone !== undefined) patch.phone = input.phone
    if (Object.keys(patch).length === 0) return { success: true, target: "profile" }

    const { error: updateError } = await svc
      .from("profiles")
      .update(patch as { first_name?: string | null; last_name?: string | null; phone?: string | null })
      .eq("id", profileRow.id)
    if (updateError) return { success: false, error: updateError.message }
    return { success: true, target: "profile" }
  }

  // Step 2: no profile — fall through to the first prospect with this
  // email. contact_name is a single free-text field so we don't split.
  const { data: prospectRow } = await svc
    .from("prospects")
    .select("id")
    .ilike("email", email)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!prospectRow?.id) {
    return { success: false, error: "No profile or prospect for this email" }
  }

  const prospectPatch: Record<string, unknown> = {}
  if (input.full_name !== undefined) {
    prospectPatch.contact_name = input.full_name?.trim() || null
  } else if (input.first_name !== undefined || input.last_name !== undefined) {
    // Reconstruct a display string when callers still send first/last.
    const combined = [input.first_name ?? "", input.last_name ?? ""].map((s) => s.trim()).filter(Boolean).join(" ")
    prospectPatch.contact_name = combined || null
  }
  if (input.phone !== undefined) prospectPatch.phone = input.phone
  if (Object.keys(prospectPatch).length === 0) return { success: true, target: "prospect" }

  const { error: prospectUpdateError } = await svc
    .from("prospects")
    .update(prospectPatch as { contact_name?: string | null; phone?: string | null })
    .eq("id", prospectRow.id)
  if (prospectUpdateError) return { success: false, error: prospectUpdateError.message }
  return { success: true, target: "prospect" }
}
