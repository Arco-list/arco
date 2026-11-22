/**
 * Eerste voorstel voor het segment van elk merk (brands.market_segment,
 * migratie 324): luxury, premium of mid, door Claude op basis van naam,
 * website, land en categorie. Merken die Claude niet zeker herkent blijven
 * leeg ("No segment" in /admin/brands), zodat een mens beslist. Alleen
 * merken zonder segment; met de hand gezette segmenten blijven staan.
 *
 *   npx tsx scripts/classify-brand-segments.ts                # alles, alleen tonen
 *   npx tsx scripts/classify-brand-segments.ts --limit 40     # proef
 *   npx tsx scripts/classify-brand-segments.ts --write        # opslaan
 */
import { readFileSync } from "node:fs"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
const MODEL = "claude-sonnet-5-5"
const write = process.argv.includes("--write")
const limitArg = process.argv.indexOf("--limit")
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity
const CHUNK = 40
const PARALLEL = 4

type Segment = "luxury" | "premium" | "mid"

const SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: { n: { type: "integer" }, segment: { type: "string", enum: ["luxury", "premium", "mid", "unknown"] } },
        required: ["n", "segment"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const

const INSTRUCTIONS = `You classify interior, design and building-product brands by market segment, for a platform that showcases high-end architecture and interior projects.

Segments:
- luxury: the absolute top end. Exclusive, very expensive, aspirational; sold through flagship stores and selected dealers. Examples: Minotti, B&B Italia, Poliform, Boffi, Gaggenau, Molteni&C, Cassina, Giorgetti, Visionnaire, Dornbracht, Officine Gullo, Henge.
- premium: high-quality design brands, clearly above the mass market but more widely available. Examples: Hay, Muuto, &Tradition, Flos, Artemide, Vitra, Gubi, Kettal, Pedrali, Fritz Hansen, Montis, Leolux.
- mid: mid-market or mass-market, contract/commodity or budget-oriented. Examples: Kave Home, Calligaris, Ideal Lux, Bontempi, generic tile or hardware producers.
- unknown: you do not recognise the brand well enough to judge it with confidence.

Judge the brand's positioning and price level, not its size. Only answer luxury, premium or mid when you are confident; otherwise answer unknown. Answer for every numbered brand.`

async function loadBrands() {
  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("brands").select("id, name, domain, country, market_segment, status")
      .neq("status", "deactivated").is("market_segment", null).order("name").order("id").range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  const cats: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from("brand_categories").select("brand_id, category_id, position").order("brand_id").order("category_id").range(from, from + 999)
    cats.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  const { data: pcs } = await supabase.from("product_categories").select("id, name")
  const catName = new Map((pcs ?? []).map((c: any) => [c.id, c.name]))
  const byBrand = new Map<string, string[]>()
  for (const c of cats.sort((a, b) => a.position - b.position)) {
    const n = catName.get(c.category_id)
    if (n) byBrand.set(c.brand_id, [...(byBrand.get(c.brand_id) ?? []), n])
  }
  return rows.map((b) => ({ id: b.id as string, name: b.name as string, domain: b.domain as string | null, country: b.country as string | null, cats: byBrand.get(b.id) ?? [] }))
}

async function classify(chunk: Array<{ name: string; domain: string | null; country: string | null; cats: string[] }>): Promise<Array<Segment | null>> {
  const list = chunk.map((b, i) => `${i + 1}. ${b.name} | ${b.domain ?? "-"} | ${b.country ?? "-"} | ${b.cats.join(", ") || "-"}`).join("\n")
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const msg = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: INSTRUCTIONS,
        output_config: { format: { type: "json_schema", schema: SCHEMA as any } },
        messages: [{ role: "user", content: `Brands (number. name | website | country | categories):\n${list}` }],
      } as any)
      if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") throw new Error(`stop: ${msg.stop_reason}`)
      const text = msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("")
      const parsed = JSON.parse(text) as { results: Array<{ n: number; segment: string }> }
      const out: Array<Segment | null> = chunk.map(() => null)
      for (const r of parsed.results) {
        if (r.n >= 1 && r.n <= chunk.length && (r.segment === "luxury" || r.segment === "premium" || r.segment === "mid")) out[r.n - 1] = r.segment
      }
      return out
    } catch (err) {
      if (attempt === 2) { console.error("chunk failed:", String(err)); return chunk.map(() => null) }
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)))
    }
  }
  return chunk.map(() => null)
}

async function main() {
  const brands = (await loadBrands()).slice(0, limit)
  console.log(`${brands.length} brands without a segment`)
  const chunks: typeof brands[] = []
  for (let i = 0; i < brands.length; i += CHUNK) chunks.push(brands.slice(i, i + CHUNK))
  const result = new Map<string, Segment | null>()
  for (let i = 0; i < chunks.length; i += PARALLEL) {
    const batch = chunks.slice(i, i + PARALLEL)
    const answers = await Promise.all(batch.map((c) => classify(c)))
    batch.forEach((c, k) => c.forEach((b, j) => result.set(b.id, answers[k][j])))
    process.stdout.write(`\r${Math.min((i + PARALLEL) * CHUNK, brands.length)}/${brands.length}`)
  }
  console.log()
  const counts = { luxury: 0, premium: 0, mid: 0, none: 0 }
  for (const v of result.values()) counts[v ?? "none"]++
  console.log(counts)
  for (const seg of ["luxury", "premium", "mid"] as const) {
    const names = brands.filter((b) => result.get(b.id) === seg).map((b) => b.name)
    console.log(`\n${seg} (${names.length}): ${names.slice(0, 40).join(", ")}${names.length > 40 ? ", …" : ""}`)
  }
  if (!write) { console.log("\n(dry run — run with --write to save)"); return }
  let saved = 0
  for (const seg of ["luxury", "premium", "mid"] as const) {
    const ids = brands.filter((b) => result.get(b.id) === seg).map((b) => b.id)
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from("brands").update({ market_segment: seg }).in("id", ids.slice(i, i + 200)).is("market_segment", null)
      if (error) console.error(error.message); else saved += ids.slice(i, i + 200).length
    }
  }
  console.log(`saved ${saved}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
