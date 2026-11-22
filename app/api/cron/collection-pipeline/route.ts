import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { tickCollectionJobs } from "@/lib/collections/pipeline"

/**
 * Collectiepijplijn — elke minuut via Vercel Cron.
 *
 * Zet elke openstaande taak in brand_collection_jobs een stap verder:
 * site in kaart, pagina's ophalen, batches bij Claude indienen en klare
 * batches verwerken (lib/collections/pipeline). Een ronde werkt hooguit
 * ~4 minuten; taken zijn geclaimd zodat overlappende rondes elkaar niet
 * in de weg zitten.
 *
 * Cron auth: Bearer CRON_SECRET, zoals de andere crons.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET
  if (!expected) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  const header = req.headers.get("authorization") ?? ""
  const provided = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!provided || provided !== expected) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 })

  const supabase = createServiceRoleSupabaseClient() as any
  const jobs = await tickCollectionJobs(supabase)
  return NextResponse.json({ ok: true, jobs })
}
