import "server-only"

import { logger } from "@/lib/logger"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

import { OUTBOUND_SITUATIONS, type OutboundSituationId } from "./templates"

/**
 * The editable half of an outbound mail.
 *
 * WHAT IS EDITABLE AND WHAT IS NOT. The subject and the body are copy,
 * and copy should not need a deploy. Which situations exist, which link
 * each one carries and what the CTA says are decisions about how the
 * funnel works — a wrong value there sends a claim link to somebody who
 * already owns their page, so those stay in code.
 *
 * ABSENT MEANS DEFAULT. A situation with no row falls back to the
 * shipped copy, which makes deleting a row the way back rather than a
 * way to break a mail. It also means the table starts empty and nothing
 * has to be seeded for the popup to work.
 */

export type StoredTemplate = {
  situationId: OutboundSituationId
  subject: string
  /** The admin's override, or null when none was saved. The caller
   *  falls back to OUTBOUND_SITUATIONS[id].body, which is a written
   *  mail too — not an empty box. */
  body: string | null
  updatedAt: string | null
}

type Row = { situation_id: string; subject: string; body: string; updated_at: string }

export async function loadStoredTemplate(
  situationId: OutboundSituationId,
): Promise<StoredTemplate> {
  const fallback: StoredTemplate = {
    situationId,
    subject: OUTBOUND_SITUATIONS[situationId]?.subject ?? "",
    body: null,
    updatedAt: null,
  }
  try {
    const svc = createServiceRoleSupabaseClient()
    const { data, error } = await (svc as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: Row | null; error: unknown }> }
        }
      }
    })
      .from("outbound_templates")
      .select("situation_id, subject, body, updated_at")
      .eq("situation_id", situationId)
      .maybeSingle()
    if (error) throw error
    if (!data) return fallback
    return {
      situationId,
      subject: data.subject || fallback.subject,
      body: data.body || null,
      updatedAt: data.updated_at ?? null,
    }
  } catch (err) {
    // A failed read must not stop a mail going out — it only costs the
    // edited wording, and the shipped copy is a correct mail too.
    logger.error("Could not load a stored outbound template", { situationId }, err as Error)
    return fallback
  }
}

export async function saveStoredTemplate(input: {
  situationId: OutboundSituationId
  subject: string
  body: string
  userId?: string | null
}): Promise<{ success: boolean; error?: string }> {
  try {
    const svc = createServiceRoleSupabaseClient()
    const { error } = await (svc as unknown as {
      from: (t: string) => {
        upsert: (v: Record<string, unknown>, o: { onConflict: string }) => Promise<{ error: unknown }>
      }
    })
      .from("outbound_templates")
      .upsert(
        {
          situation_id: input.situationId,
          subject: input.subject.trim(),
          body: input.body.trim(),
          updated_at: new Date().toISOString(),
          updated_by: input.userId ?? null,
        },
        { onConflict: "situation_id" },
      )
    if (error) throw error
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Save failed" }
  }
}

/** Back to the shipped copy. */
export async function resetStoredTemplate(
  situationId: OutboundSituationId,
): Promise<{ success: boolean; error?: string }> {
  try {
    const svc = createServiceRoleSupabaseClient()
    const { error } = await (svc as unknown as {
      from: (t: string) => { delete: () => { eq: (c: string, v: string) => Promise<{ error: unknown }> } }
    })
      .from("outbound_templates")
      .delete()
      .eq("situation_id", situationId)
    if (error) throw error
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Reset failed" }
  }
}
