"use server"

import { isAdminUser } from "@/lib/auth-utils"
import { createServerActionSupabaseClient } from "@/lib/supabase/server"
import { OUTBOUND_SITUATIONS, type OutboundSituationId } from "@/lib/outbound/templates"
import {
  loadStoredTemplate,
  saveStoredTemplate,
  resetStoredTemplate,
  type StoredTemplate,
} from "@/lib/outbound/stored-templates"

/**
 * The /emails template editor's server half.
 *
 * Admin-gated on every call, including the read: this copy goes out
 * under Niek's name from his own mailbox, so it is not something a
 * signed-in professional should be able to page through.
 */

/** Same gate the other admin actions use, via the shared isAdminUser
 *  predicate rather than a third hand-rolled copy of the check. */
async function assertAdmin(): Promise<{ userId: string | null; error: string | null }> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null, error: "Not authenticated" }
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", user.id)
    .maybeSingle()
  if (!isAdminUser(profile?.user_types, profile?.admin_role)) {
    return { userId: null, error: "Unauthorized" }
  }
  return { userId: user.id, error: null }
}

function isKnown(id: string): id is OutboundSituationId {
  return Object.prototype.hasOwnProperty.call(OUTBOUND_SITUATIONS, id)
}

export async function getOutboundTemplateAction(
  situationId: string,
): Promise<{ template: StoredTemplate | null; error?: string }> {
  const { error } = await assertAdmin()
  if (error) return { template: null, error }
  if (!isKnown(situationId)) return { template: null, error: "Unknown situation" }
  return { template: await loadStoredTemplate(situationId) }
}

export async function saveOutboundTemplateAction(input: {
  situationId: string
  subject: string
  body: string
}): Promise<{ success: boolean; error?: string }> {
  const { userId, error } = await assertAdmin()
  if (error || !userId) return { success: false, error: error ?? "Unauthorized" }
  if (!isKnown(input.situationId)) return { success: false, error: "Unknown situation" }
  if (!input.subject.trim()) return { success: false, error: "Subject is leeg" }
  if (!input.body.trim()) return { success: false, error: "Mailtekst is leeg" }
  return await saveStoredTemplate({
    situationId: input.situationId,
    subject: input.subject,
    body: input.body,
    userId,
  })
}

export async function resetOutboundTemplateAction(
  situationId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await assertAdmin()
  if (error) return { success: false, error }
  if (!isKnown(situationId)) return { success: false, error: "Unknown situation" }
  return await resetStoredTemplate(situationId)
}
