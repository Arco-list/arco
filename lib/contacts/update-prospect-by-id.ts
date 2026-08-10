"use server"

import {
  createServerActionSupabaseClient,
  createServiceRoleSupabaseClient,
} from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"

/**
 * Direct prospect-row edit for the Contact Card's prospect-keyed mode.
 *
 * Used when the card was opened via `?contact=prospect:<uuid>` — the
 * row has no email yet (Duin Interior's Showcase prospect landed with
 * an empty-string placeholder) and updateProfileByEmail can't find
 * anything to write to. This helper skips the email lookup and
 * targets the specific prospect_id.
 *
 * Supports email edits here — that's the whole point (rep is adding
 * the address in place). Once saved, the URL flips from
 * prospect:<uuid> to the new email and the card re-hydrates via the
 * full discovery layer.
 */

export type UpdateProspectByIdInput = {
  prospectId: string
  email?: string | null
  full_name?: string | null
  phone?: string | null
}

export type UpdateProspectByIdResult =
  | { success: true }
  | { success: false; error: string }

export async function updateProspectById(
  input: UpdateProspectByIdInput,
): Promise<UpdateProspectByIdResult> {
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

  const id = input.prospectId.trim()
  if (!id) return { success: false, error: "prospect id required" }

  const patch: Record<string, unknown> = {}
  if (input.email !== undefined) {
    // Normalize like the read side (getContactByEmail lowercases too).
    patch.email = input.email?.trim().toLowerCase() ?? ""
  }
  if (input.full_name !== undefined) {
    patch.contact_name = input.full_name?.trim() || null
  }
  if (input.phone !== undefined) {
    patch.phone = input.phone
  }
  if (Object.keys(patch).length === 0) return { success: true }

  const svc = createServiceRoleSupabaseClient()
  const { error } = await svc
    .from("prospects")
    .update(patch as { email?: string; contact_name?: string | null; phone?: string | null })
    .eq("id", id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
