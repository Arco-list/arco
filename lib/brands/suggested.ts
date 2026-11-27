import { slugify } from "@/lib/collections/shared"

/**
 * Een merk dat bij het beoordelen van een stip is voorgesteld en nog niet in
 * de database staat: als merk aanmaken met de status "suggested" (migratie
 * 347), niet in de selectie. Zo staat het in /admin/brands als gewone rij;
 * met een domein wordt het Added (updateBrandDomain). Geeft het id, of null
 * als het niet lukt. De slug is uniek: bij een bestaande krijgt hij -2, -3, …
 */
export async function createSuggestedBrand(sb: any, rawName: string): Promise<string | null> {
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, 120)
  if (!name) return null
  const base = slugify(name)
  for (let i = 1; i <= 20; i++) {
    const slug = i === 1 ? base : `${base}-${i}`
    const { data, error } = await sb.from("brands").insert({ name, slug, status: "suggested", is_curated: false }).select("id").single()
    if (!error && data) return data.id as string
    // Alleen bij een bezette slug opnieuw proberen.
    if (error?.code !== "23505") return null
  }
  return null
}
