/**
 * Leidt de categorieën van elk merk met collecties opnieuw af uit die
 * collecties (zelfde regel als bij het bewerken van een collectie:
 * soort → zijn subgroep, hoogstens drie). Merken zonder collecties blijven
 * ongemoeid. Nodig na een herindeling van de productcategorieën (319).
 *
 *   npx tsx scripts/resync-brand-categories.ts          # alleen tonen
 *   npx tsx scripts/resync-brand-categories.ts --write  # opslaan
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { deriveBrandCategoryIds } from "../lib/products/brand-categories"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const write = process.argv.includes("--write")

async function main() {
  const [{ data: cats }, { data: cols }, { data: kinds }, { data: brands }] = await Promise.all([
    supabase.from("product_categories").select("id, slug, name_nl, parent_id"),
    supabase.from("product_collections").select("id, brand_id, category_id"),
    supabase.from("product_collection_kinds").select("collection_id, category_id"),
    supabase.from("brands").select("id, name"),
  ])
  const label = new Map((cats ?? []).map((c: any) => [c.id, c.name_nl ?? c.slug]))
  const nameOf = new Map((brands ?? []).map((b: any) => [b.id, b.name]))
  const byBrand = new Map<string, Array<{ id: string; category_id: string | null }>>()
  for (const c of cols ?? []) byBrand.set(c.brand_id, [...(byBrand.get(c.brand_id) ?? []), c])

  let changed = 0
  for (const [brandId, rows] of byBrand) {
    const ids = new Set(rows.map((r) => r.id))
    const derived = deriveBrandCategoryIds(rows, (kinds ?? []).filter((k: any) => ids.has(k.collection_id)), cats ?? [])
    if (derived.length === 0) continue
    const { data: current } = await supabase.from("brand_categories").select("category_id").eq("brand_id", brandId).order("position")
    const before = (current ?? []).map((r: any) => r.category_id)
    if (before.join() === derived.join()) continue
    changed++
    console.log(`${nameOf.get(brandId)}: ${before.map((id) => label.get(id)).join(", ") || "-"}  →  ${derived.map((id) => label.get(id)).join(", ")}`)
    if (write) {
      await supabase.from("brand_categories").delete().eq("brand_id", brandId)
      await supabase.from("brand_categories").insert(derived.map((category_id, position) => ({ brand_id: brandId, category_id, position })))
    }
  }
  console.log(`${changed} merken ${write ? "bijgewerkt" : "zouden wijzigen (--write om op te slaan)"}`)
}
main()
