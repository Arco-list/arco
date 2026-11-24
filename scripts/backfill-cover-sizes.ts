/**
 * Maat (breedte × hoogte) van omslagfoto's van collecties die er nog geen
 * hebben, zodat de kaart het focuspunt kan centreren. Gratis.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-cover-sizes.ts
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)

async function main() {
  const { storePhotoSize } = await import("../lib/collections/shared")
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data } = await sb.from("product_collection_photos").select("id, url").eq("is_primary", true).is("width", null)
  const rows = data ?? []
  for (let i = 0; i < rows.length; i += 5) await Promise.all(rows.slice(i, i + 5).map((r) => storePhotoSize(sb, r.id, r.url)))
  const { count } = await sb.from("product_collection_photos").select("id", { count: "exact", head: true }).eq("is_primary", true).is("width", null)
  console.log(`${rows.length} omslagen zonder maat; nog ${count ?? "?"} over`)
}
main().catch((e) => { console.error(e); process.exit(1) })
