/**
 * Langere merkbeschrijvingen in het Engels en Nederlands (migratie 330):
 * de homepage gratis lezen (geen Firecrawl) en Claude 3–4 zinnen laten
 * schrijven. Zonder argumenten: alle merken met collecties.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/refresh-brand-descriptions.ts [brandId …]
 */
import { readFileSync } from "node:fs"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const SCHEMA = {
  type: "object",
  properties: { en: { type: ["string", "null"] }, nl: { type: ["string", "null"] } },
  required: ["en", "nl"],
  additionalProperties: false,
} as const

async function main() {
  const { fetchPage } = await import("../lib/collections/fetch-page")
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

  let ids = process.argv.slice(2)
  if (ids.length === 0) {
    const { data } = await sb.from("product_collections").select("brand_id")
    ids = Array.from(new Set((data ?? []).map((r) => r.brand_id)))
  }
  const { data: brands } = await sb.from("brands").select("id, name, website, domain, description").in("id", ids)
  let done = 0
  for (const b of brands ?? []) {
    const site = b.website || (b.domain ? `https://${b.domain}/` : null)
    const page = site ? await fetchPage(site, { maxChars: 20_000, firecrawlKey: "" }) : null
    if (!page && !b.description) { console.log(`– ${b.name}: homepage niet gratis te lezen`); continue }
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Write a description of the interior products brand "${b.name}" for an editorial directory: three or four sentences in English (60–100 words) — where it comes from, what it makes, its design language and what it is known for — factual, without marketing superlatives. Then the same text in natural, editorial Dutch (as a Dutch design magazine would write it). Base it on the homepage text below${b.description ? " and the current short description" : ""}; null for both if there is nothing usable.
${b.description ? `\nCurrent description: ${b.description}\n` : ""}
Homepage (${page?.url ?? site}):
${page?.text.slice(0, 20_000) ?? "(not available)"}`,
      }],
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    } as any)
    const text = (msg.content as any[]).find((x) => x.type === "text")?.text
    const out = text ? JSON.parse(text) as { en: string | null; nl: string | null } : null
    if (!out?.en) { console.log(`– ${b.name}: niets bruikbaars`); continue }
    await sb.from("brands").update({ description: out.en.trim(), translations: { en: { description: out.en.trim() }, nl: { description: (out.nl ?? out.en).trim() } } }).eq("id", b.id)
    done++
    console.log(`✓ ${b.name} (${out.en.length} tekens)`)
  }
  console.log(`\n${done}/${brands?.length ?? 0} merken bijgewerkt`)
}
main().catch((e) => { console.error(e); process.exit(1) })
