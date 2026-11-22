/**
 * Werkelijke Claude-kosten van de collectiepijplijn voor één merk: alle
 * batches sinds een tijdstip, per antwoord het tokenverbruik, toegewezen
 * aan het merk via de taak (inventarisatie) of de collectie (r_/p_<id>).
 *
 *   npx tsx scripts/collection-pipeline-costs.ts <brand-id> <sinds-ISO>
 *
 * Prijzen: Sonnet 5.5, $2 / $10 per miljoen tokens (in / uit), cache
 * lezen $0,10, cache schrijven 1,25× invoer; via de batch-API de helft.
 */
import { readFileSync } from "node:fs"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const PRICE = { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 } // $ per miljoen, standaard
const BATCH = 0.5

async function main() {
  const [brandId, since] = process.argv.slice(2)
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

  const { data: jobs } = await sb.from("brand_collection_jobs").select("kind, state, firecrawl_credits").eq("brand_id", brandId).gte("created_at", since)
  const inventoryBatches = new Set<string>()
  for (const j of jobs ?? []) {
    if (j.state?.batch) inventoryBatches.add(j.state.batch)
    for (const b of (j.state?.batches ?? [])) inventoryBatches.add(typeof b === "string" ? b : b.id)
  }
  const credits = (jobs ?? []).reduce((n: number, j: any) => n + (j.firecrawl_credits ?? 0), 0)
  const { data: cols } = await sb.from("product_collections").select("id").eq("brand_id", brandId)
  const colIds = new Set((cols ?? []).map((c: any) => c.id))

  const sinceMs = new Date(since).getTime()
  const steps: Record<string, { n: number; input: number; output: number; cacheRead: number; cacheWrite: number }> = {}
  const add = (step: string, u: any) => {
    const s = (steps[step] ??= { n: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })
    s.n++; s.input += u.input_tokens ?? 0; s.output += u.output_tokens ?? 0
    s.cacheRead += u.cache_read_input_tokens ?? 0; s.cacheWrite += u.cache_creation_input_tokens ?? 0
  }
  for await (const batch of client.messages.batches.list({ limit: 100 })) {
    if (new Date(batch.created_at).getTime() < sinceMs) continue
    if (batch.processing_status !== "ended") continue
    const isInventory = inventoryBatches.has(batch.id)
    for await (const r of await client.messages.batches.results(batch.id)) {
      if (r.result.type !== "succeeded") continue
      const id = r.custom_id
      let step: string | null = null
      if (isInventory) step = id === "pick" ? "1. pagina's kiezen" : "1. overzicht lezen"
      else if (id.startsWith("r_") && colIds.has(id.slice(2))) step = "2. collectiepagina lezen"
      else if (id.startsWith("p_") && colIds.has(id.slice(2))) step = "2. sfeerbeelden kiezen"
      if (step) add(step, r.result.message.usage)
    }
  }
  let total = 0
  for (const [step, s] of Object.entries(steps).sort()) {
    const cost = BATCH * (s.input * PRICE.input + s.output * PRICE.output + s.cacheRead * PRICE.cacheRead + s.cacheWrite * PRICE.cacheWrite) / 1e6
    total += cost
    console.log(`${step}: ${s.n} verzoeken, in ${s.input} / uit ${s.output} / cache lezen ${s.cacheRead} / cache schrijven ${s.cacheWrite} → $${cost.toFixed(3)}`)
  }
  console.log(`Claude totaal: $${total.toFixed(3)} | Firecrawl: ${credits} credits`)
}
main().catch((e) => { console.error(e); process.exit(1) })
