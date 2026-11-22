/**
 * Elke collectie met foto's: een focuspunt voor de hero als die er nog
 * geen heeft (lib/collections/hero-focus). Eén Claude-blik per collectie.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-hero-focus.ts
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
for (const k of ["ANTHROPIC_API_KEY"]) if (!process.env[k] && env[k]) process.env[k] = env[k]

async function main() {
  const { ensureHeroFocus } = await import("../lib/collections/hero-focus")
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const ids = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from("product_collection_photos").select("collection_id").order("id").range(from, from + 999)
    for (const r of data ?? []) ids.add(r.collection_id)
    if (!data || data.length < 1000) break
  }
  const list = [...ids]
  let done = 0
  let next = 0
  const worker = async () => {
    while (next < list.length) {
      const id = list[next++]
      await ensureHeroFocus(sb, id)
      done++
      if (done % 20 === 0) console.log(`${done}/${list.length}`)
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  const { count } = await sb.from("product_collection_photos").select("id", { count: "exact", head: true }).not("focus_x", "is", null)
  console.log(`klaar: ${list.length} collecties, ${count} foto's met focuspunt`)
}
main().catch((e) => { console.error(e); process.exit(1) })
