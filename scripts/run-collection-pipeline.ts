/**
 * De collectiepijplijn lokaal draaien, zonder op de Vercel-cron te wachten:
 * elke 30 seconden een ronde (tickCollectionJobs), tot er niets meer
 * loopt. Handig in development, waar de cron niet draait.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/run-collection-pipeline.ts
 *
 * (--conditions=react-server: de pijplijn is "server-only".)
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v

async function main() {
  const { tickCollectionJobs } = await import("../lib/collections/pipeline")
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  for (let round = 1; round <= 240; round++) {
    // Vasthouden: een cron met oudere code pakt deze taken dan niet op.
    const report = await tickCollectionJobs(sb, { holder: "local" })
    const { data: jobs } = await sb.from("brand_collection_jobs").select("id, kind, stage, progress_done, progress_total, error, firecrawl_credits").not("stage", "in", "(done,error)")
    console.log(new Date().toISOString().slice(11, 19), `round ${round}`, JSON.stringify(report), `| open: ${jobs?.length ?? 0}`, (jobs ?? []).map((j: any) => `${j.kind}:${j.stage} ${j.progress_done}/${j.progress_total}`).join(", "))
    if (!jobs?.length) break
    await new Promise((r) => setTimeout(r, 30_000))
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
