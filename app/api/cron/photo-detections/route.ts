import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { tickPhotoDetections } from "@/lib/recognition/photo-detections"

/**
 * Productherkenning op projectfoto's — elke minuut via Vercel Cron.
 *
 * Verwerkt klare batches en dient wachtende foto's in
 * (lib/recognition/photo-detections, migratie 332). Rondes mogen
 * overlappen: foto's en uitkomsten worden geclaimd.
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
  const result = await tickPhotoDetections(supabase)
  return NextResponse.json({ ok: true, ...result })
}
