/**
 * Logokandidaten zoeken voor een steekproef merken zonder logo, zonder iets
 * op te slaan: hoeveel levert de website zelf op?
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/test-find-logo.ts [aantal]
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)

async function main() {
  const { findLogoCandidates } = await import("../lib/brands/find-logo")
  const n = Number(process.argv[2] ?? 15)
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data } = await sb.from("brands").select("name, website, domain").neq("status", "deactivated").or("logo_url.is.null,logo_url.eq.").order("name").limit(n)
  let withAny = 0
  const kinds: Record<string, number> = {}
  for (const b of data ?? []) {
    const site = b.website || (b.domain ? `https://${b.domain}/` : null)
    const c = site ? await findLogoCandidates(site) : []
    if (c.length) withAny++
    for (const k of new Set(c.map((x) => x.kind))) kinds[k] = (kinds[k] ?? 0) + 1
    console.log(`${b.name.padEnd(28)} ${c.length} → ${c.map((x) => x.kind + (x.svg ? "(svg)" : "")).join(", ")}`)
  }
  console.log(`\n${withAny}/${data?.length ?? 0} met minstens één kandidaat`, kinds)
}
main().catch((e) => { console.error(e); process.exit(1) })
