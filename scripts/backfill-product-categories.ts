/**
 * Bestaande producten een Arco-categorie geven (migratie 327): per collectie
 * één Claude-vraag met de productnamen, de soorten van de collectie en de
 * lijst met soorten (gecachet). Alleen producten zonder categorie.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-product-categories.ts
 */
import { readFileSync } from "node:fs"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const MODEL = "claude-sonnet-5-5"
const SCHEMA = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: { type: "object", properties: { id: { type: "string" }, kind_slug: { type: ["string", "null"] } }, required: ["id", "kind_slug"], additionalProperties: false },
    },
  },
  required: ["products"],
  additionalProperties: false,
} as const

async function main() {
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

  const { data: cats } = await sb.from("product_categories").select("id, slug, name, parent_id")
  const rows = (cats ?? []) as Array<{ id: string; slug: string; name: string; parent_id: string | null }>
  const byId = new Map(rows.map((r) => [r.id, r]))
  const hasChild = new Set(rows.map((r) => r.parent_id).filter(Boolean))
  const path = (r: { name: string; parent_id: string | null }) => {
    const parts: string[] = []
    let cur: { name: string; parent_id: string | null } | undefined = r
    for (let i = 0; cur && i < 6; i++) { parts.unshift(cur.name); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined }
    return parts.join(" › ")
  }
  const leaves = rows.filter((r) => !hasChild.has(r.id))
  const idBySlug = new Map(leaves.map((r) => [r.slug, r.id]))
  const menu = leaves.map((r) => `${r.slug} — ${path(r)}`).join("\n")

  const { data: products } = await sb.from("products").select("id, name, collection_id").is("category_id", null).limit(5000)
  const byCol = new Map<string, Array<{ id: string; name: string }>>()
  for (const p of products ?? []) { const l = byCol.get(p.collection_id) ?? []; l.push({ id: p.id, name: p.name }); byCol.set(p.collection_id, l) }

  const colIds = [...byCol.keys()]
  const { data: cols } = await sb.from("product_collections").select("id, name, brand:brands(name)").in("id", colIds)
  const { data: kinds } = await sb.from("product_collection_kinds").select("collection_id, category_id").in("collection_id", colIds)
  const kindSlugs = new Map<string, string[]>()
  for (const k of kinds ?? []) { const s = byId.get(k.category_id)?.slug; if (s) kindSlugs.set(k.collection_id, [...(kindSlugs.get(k.collection_id) ?? []), s]) }

  let set = 0, none = 0, next = 0, done = 0
  let inTok = 0, outTok = 0, cacheRead = 0, cacheWrite = 0
  const worker = async () => {
    while (next < colIds.length) {
      const colId = colIds[next++]
      const col = (cols ?? []).find((c) => c.id === colId) as any
      const list = byCol.get(colId)!
      try {
        const msg = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 4000,
          system: [{ type: "text", text: `Product kinds (slug — group › subgroup › kind):\n${menu}`, cache_control: { type: "ephemeral" } }],
          messages: [{
            role: "user",
            content: `Collection "${col?.name}" by "${col?.brand?.name}". Its kinds: ${(kindSlugs.get(colId) ?? []).join(", ") || "unknown"}.

For each product below, give the single most specific kind slug from the list that this one product is (a lounge chair, a footstool, a side table), preferring the collection's kinds when they fit; null when none fits.

${list.map((p) => `${p.id}: ${p.name}`).join("\n")}`,
          }],
          output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        } as any)
        inTok += msg.usage.input_tokens; outTok += msg.usage.output_tokens
        cacheRead += (msg.usage as any).cache_read_input_tokens ?? 0; cacheWrite += (msg.usage as any).cache_creation_input_tokens ?? 0
        const text = (msg.content as any[]).find((b) => b.type === "text")?.text
        const out = text ? (JSON.parse(text).products as Array<{ id: string; kind_slug: string | null }>) : []
        for (const r of out) {
          const cid = r.kind_slug ? idBySlug.get(r.kind_slug) : undefined
          if (!cid || !list.some((p) => p.id === r.id)) { none++; continue }
          await sb.from("products").update({ category_id: cid }).eq("id", r.id)
          set++
        }
      } catch (e) {
        console.error(colId, String(e))
      }
      done++
      if (done % 20 === 0) console.log(`${done}/${colIds.length}`)
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  const cost = (inTok * 2 + cacheWrite * 2.5 + cacheRead * 0.2 + outTok * 10) / 1e6
  console.log(`klaar: ${set} producten met categorie, ${none} zonder · ~$${cost.toFixed(2)}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
