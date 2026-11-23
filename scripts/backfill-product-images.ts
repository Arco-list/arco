/**
 * Producten zonder beeld maar met een eigen pagina bij het merk: het
 * hoofdbeeld van die pagina (og:image) naar onze opslag. Gratis.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-product-images.ts
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)

async function main() {
  const { pageMainImage, storeRemoteImage } = await import("../lib/collections/shared")
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data } = await sb.from("products").select("id, name, url, slug, collection_id").is("image_url", null).not("url", "is", null)
  let found = 0
  for (const p of data ?? []) {
    const src = await pageMainImage(p.url)
    const stored = src ? await storeRemoteImage(sb, src, `product-families/${p.collection_id}/products`, p.slug) : null
    if (stored) {
      await sb.from("products").update({ image_url: stored, source_image_url: src }).eq("id", p.id)
      found++
    }
    console.log(`${stored ? "✓" : "–"} ${p.name}`)
  }
  console.log(`\n${found}/${data?.length ?? 0} met beeld`)
}
main().catch((e) => { console.error(e); process.exit(1) })
