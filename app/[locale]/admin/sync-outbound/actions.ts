"use server"

import { syncOutboundToNotion, type OutboundSyncResult } from "@/lib/notion/outbound-sync"
import { logger } from "@/lib/logger"

export async function runOutboundSync(): Promise<
  { ok: true; result: OutboundSyncResult; durationMs: number } | { ok: false; error: string }
> {
  // Admin gate is enforced one level up by app/[locale]/admin/layout.tsx
  // (uses isAdminUser). Server actions inherit the same request context,
  // so reaching this function already implies an authenticated admin.
  const startedAt = Date.now()
  try {
    const result = await syncOutboundToNotion()
    const durationMs = Date.now() - startedAt
    logger.info("[admin/sync-outbound] completed", { ...result, durationMs })
    return { ok: true, result, durationMs }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error("[admin/sync-outbound] failed", { err: msg })
    return { ok: false, error: msg }
  }
}
