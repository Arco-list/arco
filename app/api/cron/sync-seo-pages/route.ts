import { NextRequest, NextResponse } from "next/server"

import { logger } from "@/lib/logger"
import { syncSeoPageMetrics, syncSeoQueryMetrics, syncSeoDailyMetrics, syncSitemapCounts } from "@/lib/seo/sync-pages"

/**
 * Search Console-cijfers: per pagina, per zoekopdracht, per dag.
 *
 * APART VAN /api/cron/sync-gsc-indexation. Die taak inspecteert 274
 * URL's één voor één en vult daarmee de 300 seconden van Vercel; deze
 * taak doet drie bulkaanroepen en is in seconden klaar. Samen in één
 * route betekende dat de bulkaanroepen vanaf 30 september niet meer
 * werden bereikt — vier dagen lang, zonder dat er iets faalde wat je
 * kon zien.
 *
 * Elke stap is op zichzelf best-effort: een backfill van 90 dagen mag
 * niet sneuvelen omdat de sitemap even niet antwoordt. Wat lukt wordt
 * weggeschreven, wat niet lukt staat in het antwoord.
 *
 * Auth: Vercel Cron stuurt `Authorization: Bearer ${CRON_SECRET}`.
 * Handmatig draaien kan met ?secret=...&days=480 voor een backfill.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }
  const header = request.headers.get("authorization") ?? ""
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : ""
  const queryToken = request.nextUrl.searchParams.get("secret") ?? ""
  if (bearer !== expected && queryToken !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // ?days=480 haalt alles wat Search Console bewaart (16 maanden). Zonder
  // parameter het normale venster, dat ruim genoeg is om correcties van
  // Google mee te nemen.
  const daysParam = Number(request.nextUrl.searchParams.get("days") ?? "")
  const range = Number.isFinite(daysParam) && daysParam > 0
    ? (() => {
        const end = new Date(); end.setDate(end.getDate() - 2)
        const start = new Date(end); start.setDate(start.getDate() - daysParam)
        return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
      })()
    : undefined

  const result: Record<string, unknown> = {}
  const steps: Array<[string, () => Promise<unknown>]> = [
    ["pages", () => syncSeoPageMetrics(range)],
    ["queries", () => syncSeoQueryMetrics()],
    ["daily", () => syncSeoDailyMetrics()],
    ["sitemap", () => syncSitemapCounts()],
  ]

  for (const [name, run] of steps) {
    try {
      result[name] = await run()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result[name] = { error: message }
      logger.error(`[seo-sync] ${name} failed`, {}, err as Error)
    }
  }

  logger.info("[seo-sync] done", result)
  return NextResponse.json({ success: true, ...result })
}
