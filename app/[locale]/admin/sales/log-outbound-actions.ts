"use server"

import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { isAdminUser } from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"

export type OutboundKind = "call" | "meeting" | "email" | "linkedin" | "note"
export type OutboundOutcome = "positive" | "neutral" | "negative" | "no_answer"

export type LogOutboundInput = {
  prospectId: string
  kind: OutboundKind
  outcome?: OutboundOutcome | null
  occurredAt?: string | null // ISO; defaults to now() on the server
  body?: string | null
  nextFollowUpAt?: string | null // ISO; null clears
}

export type LogOutboundResult =
  | { ok: true; logId: string }
  | { ok: false; error: string }

async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id
  if (!userId) return { ok: false, error: "unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", userId)
    .maybeSingle()
  if (!isAdminUser(profile?.user_types, profile?.admin_role)) {
    return { ok: false, error: "forbidden" }
  }
  return { ok: true, userId }
}

export async function logOutboundContact(input: LogOutboundInput): Promise<LogOutboundResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: gate.error }

  // Notes don't carry outcomes — strip if present.
  const outcome = input.kind === "note" ? null : (input.outcome ?? null)
  const body = input.body?.trim() || null

  const service = createServiceRoleSupabaseClient()
  const { data, error } = await service
    .from("outbound_contact_log")
    .insert({
      prospect_id: input.prospectId,
      created_by: gate.userId,
      kind: input.kind,
      outcome,
      body,
      ...(input.occurredAt ? { created_at: input.occurredAt } : {}),
    })
    .select("id")
    .single()

  if (error) {
    logger.error("[log-outbound] insert failed", { prospectId: input.prospectId, err: error.message })
    return { ok: false, error: error.message }
  }

  // next_follow_up_at is rep-owned and write-through on every log. Set
  // explicit null to clear, otherwise leave unchanged when the form
  // doesn't include the field.
  if (input.nextFollowUpAt !== undefined) {
    const { error: updateErr } = await service
      .from("prospects")
      .update({ next_follow_up_at: input.nextFollowUpAt })
      .eq("id", input.prospectId)
    if (updateErr) {
      logger.error("[log-outbound] next_follow_up_at update failed", {
        prospectId: input.prospectId,
        err: updateErr.message,
      })
      // Log insert succeeded — don't surface the secondary failure.
    }
  }

  revalidatePath("/[locale]/admin/sales", "page")
  return { ok: true, logId: (data as { id: string }).id }
}

export type UpdateOutboundLogInput = {
  logId: string
  kind: OutboundKind
  outcome?: OutboundOutcome | null
  occurredAt?: string | null // ISO
  body?: string | null
  nextFollowUpAt?: string | null // ISO; null clears, undefined leaves unchanged
}

export async function updateOutboundLog(
  input: UpdateOutboundLogInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: gate.error }

  const outcome = input.kind === "note" ? null : (input.outcome ?? null)
  const body = input.body?.trim() || null

  const service = createServiceRoleSupabaseClient()

  const { data: existing, error: fetchErr } = await service
    .from("outbound_contact_log")
    .select("prospect_id")
    .eq("id", input.logId)
    .maybeSingle()
  if (fetchErr || !existing) {
    return { ok: false, error: fetchErr?.message ?? "log not found" }
  }
  const prospectId = (existing as { prospect_id: string }).prospect_id

  const { error } = await service
    .from("outbound_contact_log")
    .update({
      kind: input.kind,
      outcome,
      body,
      ...(input.occurredAt ? { created_at: input.occurredAt } : {}),
    })
    .eq("id", input.logId)
  if (error) {
    logger.error("[log-outbound] update failed", { logId: input.logId, err: error.message })
    return { ok: false, error: error.message }
  }

  // Recompute last_outbound_at across surviving non-note rows so the
  // column doesn't drift when kind flips to/from note or occurredAt
  // moves. Cheap: one indexed lookup per edit.
  const { data: latest } = await service
    .from("outbound_contact_log")
    .select("created_at")
    .eq("prospect_id", prospectId)
    .neq("kind", "note")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const newLast = (latest as { created_at: string } | null)?.created_at ?? null
  await service.from("prospects").update({ last_outbound_at: newLast }).eq("id", prospectId)

  if (input.nextFollowUpAt !== undefined) {
    await service
      .from("prospects")
      .update({ next_follow_up_at: input.nextFollowUpAt })
      .eq("id", prospectId)
  }

  revalidatePath("/[locale]/admin/sales", "page")
  return { ok: true }
}

export async function clearNextFollowUp(prospectId: string): Promise<{ ok: boolean }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false }

  const service = createServiceRoleSupabaseClient()
  const { error } = await service
    .from("prospects")
    .update({ next_follow_up_at: null })
    .eq("id", prospectId)
  if (error) {
    logger.error("[log-outbound] clearNextFollowUp failed", { prospectId, err: error.message })
    return { ok: false }
  }
  revalidatePath("/[locale]/admin/sales", "page")
  return { ok: true }
}

export async function deleteOutboundLog(logId: string): Promise<{ ok: boolean }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false }

  const service = createServiceRoleSupabaseClient()
  // Capture prospect_id before delete so we can recompute last_outbound_at.
  const { data: row } = await service
    .from("outbound_contact_log")
    .select("prospect_id, kind")
    .eq("id", logId)
    .maybeSingle()

  const { error } = await service.from("outbound_contact_log").delete().eq("id", logId)
  if (error) {
    logger.error("[log-outbound] delete failed", { logId, err: error.message })
    return { ok: false }
  }

  // The trigger only updates last_outbound_at on INSERT. After a delete,
  // recompute it from the surviving rows for that prospect so the column
  // doesn't drift.
  if (row && (row as { kind: string }).kind !== "note") {
    const pid = (row as { prospect_id: string }).prospect_id
    const { data: latest } = await service
      .from("outbound_contact_log")
      .select("created_at")
      .eq("prospect_id", pid)
      .neq("kind", "note")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    const newLast = (latest as { created_at: string } | null)?.created_at ?? null
    await service.from("prospects").update({ last_outbound_at: newLast }).eq("id", pid)
  }

  revalidatePath("/[locale]/admin/sales", "page")
  return { ok: true }
}
