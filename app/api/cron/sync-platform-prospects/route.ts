import { NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { syncPlatformProspects } from "../../../[locale]/admin/sales/actions"

/**
 * Platform-prospects sync cron — runs the four-loop reconciliation that
 * used to fire on every /admin/sales page load:
 *   1. prospected companies → prospects (source=arco)
 *   2. invited pros (project_professionals) → prospects (source=invites)
 *   3. clean up invite prospects for companies with no invites
 *   4. link Apollo prospects to claimed companies by email domain
 *
 * Moving this off the render path is the single biggest /admin/sales
 * perf win — it does N+1 queries in 4 different loops, easily seconds
 * of DB round-trips on cold cache.
 *
 * Auth: Vercel Cron passes `Authorization: Bearer ${CRON_SECRET}`.
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

  try {
    await syncPlatformProspects()
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error("cron-sync-platform-prospects failed", {}, err as Error)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
