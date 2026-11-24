/**
 * Beelden van edra.com zonder zwarte balken. Hun beeldschaler
 * (ridimensiona.html/rem/B/H/vlag__/) vulde elk beeld op tot 1170×750
 * (vlag 030) of sneed het bij (100); de pijplijn vraagt nu vlag 000, het
 * beeld in zijn eigen verhouding (upsize in lib/collections/pipeline).
 * Dit script haalt de al opgeslagen beelden opnieuw op, onder een nieuwe
 * naam (de oude staan een jaar in de cache), en zoekt per collectie het
 * focuspunt van de hero opnieuw (het oude lag op het opgevulde beeld).
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/fix-padded-images.ts [--dry]
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
for (const k of ["ANTHROPIC_API_KEY", "FIRECRAWL_API_KEY"]) if (env[k] && !process.env[k]) process.env[k] = env[k]

const DRY = process.argv.includes("--dry")
const RESIZED = /\/ridimensiona\.html\/rem\/\d+\/\d+\/(?!000)\d{3}__\//i
/** De map van een opgeslagen beeld: alles tussen company-assets/ en de bestandsnaam. */
const folderOf = (url: string, fallback: string) => url.match(/\/company-assets\/(.+)\/[^/]+$/)?.[1] ?? fallback

async function inBatches<T>(rows: T[], size: number, fn: (r: T) => Promise<void>) {
  for (let i = 0; i < rows.length; i += size) await Promise.all(rows.slice(i, i + size).map(fn))
}

async function main() {
  const { storeRemoteImage, syncCollectionCover } = await import("../lib/collections/shared")
  const { upsize } = await import("../lib/collections/pipeline")
  const { imageSize } = await import("../lib/images/image-size")
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) as any
  const all = async (table: string, cols: string, srcCol: string) => {
    const out: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from(table).select(cols).like(srcCol, "%ridimensiona.html/rem/%").range(from, from + 999)
      if (error) throw error
      out.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return out.filter((r) => RESIZED.test(r[srcCol]))
  }
  let ok = 0, failed = 0
  const store = async (src: string, folder: string) => {
    const next = upsize(src)
    if (DRY) { ok++; return { next, stored: "(dry)" } }
    const stored = await storeRemoteImage(sb, next, folder)
    if (stored) ok++; else failed++
    return { next, stored }
  }

  // 1. Sfeer- en productfoto's van collecties.
  const photos = await all("product_collection_photos", "id, collection_id, url, source_url", "source_url")
  console.log(`collectiefoto's: ${photos.length}`)
  const touched = new Set<string>()
  await inBatches(photos, 6, async (p) => {
    const { next, stored } = await store(p.source_url, folderOf(p.url, `product-families/${p.collection_id}`))
    if (!stored || DRY) return
    let size: { width: number; height: number } | null = null
    try { const r = await fetch(stored); if (r.ok) size = imageSize(new Uint8Array(await r.arrayBuffer())) } catch { /* geen maat */ }
    await sb.from("product_collection_photos").update({ url: stored, source_url: next, width: size?.width ?? null, height: size?.height ?? null, focus_x: null, focus_y: null }).eq("id", p.id)
    touched.add(p.collection_id)
  })

  // 2. Hoofdbeelden van producten.
  const products = await all("products", "id, collection_id, image_url, source_image_url", "source_image_url")
  console.log(`producten: ${products.length}`)
  await inBatches(products, 6, async (p) => {
    const { next, stored } = await store(p.source_image_url, folderOf(p.image_url ?? "", `product-families/${p.collection_id}/products`))
    if (stored && !DRY) await sb.from("products").update({ image_url: stored, source_image_url: next }).eq("id", p.id)
  })

  // 3. Extra productbeelden.
  const extras = await all("product_photos", "id, product_id, url, source_url", "source_url")
  console.log(`extra productbeelden: ${extras.length}`)
  await inBatches(extras, 6, async (p) => {
    const { next, stored } = await store(p.source_url, folderOf(p.url, `product-families/extra/${p.product_id}`))
    if (stored && !DRY) await sb.from("product_photos").update({ url: stored, source_url: next }).eq("id", p.id)
  })

  // 4. Kandidaten (het beeld in de kiezer).
  const cands = await all("brand_collection_candidates", "id, brand_id, image_url, source_image_url", "source_image_url")
  console.log(`kandidaten: ${cands.length}`)
  await inBatches(cands, 6, async (c) => {
    const { next, stored } = await store(c.source_image_url, folderOf(c.image_url ?? "", `brand-candidates/${c.brand_id}`))
    if (stored && !DRY) await sb.from("brand_collection_candidates").update({ image_url: stored, source_image_url: next }).eq("id", c.id)
  })

  // 5. Omslag en focuspunt per collectie opnieuw.
  console.log(`collecties met nieuwe foto's: ${touched.size}`)
  for (const id of touched) await syncCollectionCover(sb, id)

  console.log(`\n${ok} opgeslagen, ${failed} mislukt${DRY ? " (dry run)" : ""}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
