import "server-only"

import Anthropic from "@anthropic-ai/sdk"

import { logger } from "@/lib/logger"
import { PIPELINE_MODEL } from "@/lib/collections/prompts"
import { slugify, storeRemoteImage } from "@/lib/collections/shared"

/**
 * Productfamilies (migratie 339). Sommige merken tonen geen collecties maar
 * losse producten en varianten — Flos: "2097/18", "2097/30", "2097/18 E12".
 * Na het lezen van de pagina's legt Claude alle gevonden namen naast elkaar
 * en groepeert varianten tot de familie die het merk zelf gebruikt ("2097").
 * Eén kandidaat per familie; de varianten worden bij het kiezen de producten
 * van de collectie.
 */

const SCHEMA = {
  type: "object",
  properties: {
    families: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, members: { type: "array", items: { type: "integer" } } },
        required: ["name", "members"],
        additionalProperties: false,
      },
    },
  },
  required: ["families"],
  additionalProperties: false,
} as const

const CHUNK = 400

/**
 * Namen groeperen tot families: per familie de naam en de indexen van de
 * namen die erbij horen. Elke index komt precies één keer voor; lukt het
 * niet, dan is elke naam zijn eigen familie.
 */
export async function groupIntoFamilies(brandName: string, names: string[]): Promise<Array<{ name: string; members: number[] }>> {
  const single = (from: number, xs: string[]) => xs.map((name, i) => ({ name, members: [from + i] }))
  if (names.length < 2 || !process.env.ANTHROPIC_API_KEY) return single(0, names)
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const out: Array<{ name: string; members: number[] }> = []
  for (let from = 0; from < names.length; from += CHUNK) {
    const chunk = names.slice(from, from + CHUNK)
    try {
      const msg = await client.messages.create({
        model: PIPELINE_MODEL,
        max_tokens: 8000,
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        messages: [{
          role: "user",
          content: `These names were found on the website of the design brand "${brandName}". Some sites list collections, others list every product and variant separately.

Group the names into the product families (collections, lines) the brand itself uses. Variants that differ only by size, number, version, light source, finish, colour or mounting belong to one family: "2097/18", "2097/30", "2097/18 E12" → "2097"; "Taccia", "Taccia Small", "Taccia LED" → "Taccia"; "IC Lights Ceiling 1", "IC Lights Floor 2" → "IC Lights". Different designs that only share a word are separate families ("Arco" and "Arco Bianco" may be one family, but "Bellhop" and "Bellhop Wall" are one too — judge by the brand's naming). A name that stands alone is its own family.

- name: the family as the brand writes it, without size, number or variant.
- members: the numbers of the names that belong to it. Use every number exactly once.

${chunk.map((n, i) => `${i}. ${n}`).join("\n")}`,
        }],
      } as any)
      const text = (msg.content as Array<{ type: string; text?: string }>).filter((b) => b.type === "text").map((b) => b.text ?? "").join("")
      const parsed = JSON.parse(text) as { families: Array<{ name: string; members: number[] }> }
      const seen = new Set<number>()
      for (const f of parsed.families ?? []) {
        const members = (f.members ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < chunk.length && !seen.has(i))
        if (!members.length || !f.name?.trim()) continue
        members.forEach((i) => seen.add(i))
        out.push({ name: f.name.trim(), members: members.map((i) => from + i) })
      }
      // Vergeten namen: hun eigen familie.
      chunk.forEach((name, i) => { if (!seen.has(i)) out.push({ name, members: [from + i] }) })
    } catch (err) {
      logger.warn("Grouping into families failed", { brandName, error: String(err) })
      out.push(...single(from, chunk))
    }
  }
  return out
}

export type FamilyProduct = { name: string; url: string | null; image_url: string | null; source_image_url: string | null }

type CandidateRow = {
  id: string; name: string; slug: string; url: string | null; source_page_url: string | null; description: string | null
  category_id: string | null; image_url: string | null; source_image_url: string | null; products: FamilyProduct[] | null
  status: string; collection_id: string | null
}

/** Varianten als producten aan een bestaande collectie toevoegen (nieuwe op naam en url). */
async function addProductsToCollection(sb: any, brandId: string, collectionId: string, categoryId: string | null, items: FamilyProduct[]): Promise<number> {
  const { data: known } = await sb.from("products").select("slug, url, position").eq("collection_id", collectionId)
  const slugs = new Set(((known ?? []) as Array<{ slug: string }>).map((p) => p.slug))
  const urls = new Set(((known ?? []) as Array<{ url: string | null }>).map((p) => p.url).filter(Boolean))
  let position = ((known ?? []) as Array<{ position: number | null }>).reduce((m, p) => Math.max(m, p.position ?? 0), 0) + 1
  let added = 0
  for (const p of items.slice(0, 40)) {
    const slug = slugify(p.name)
    if (!slug || slugs.has(slug) || (p.url && urls.has(p.url))) continue
    slugs.add(slug)
    const src = p.source_image_url ?? p.image_url
    const stored = p.image_url ?? (src ? await storeRemoteImage(sb, src, `product-families/${collectionId}/products`, slug) : null)
    const { error } = await sb.from("products").insert({
      brand_id: brandId, collection_id: collectionId, slug, name: p.name, url: p.url,
      image_url: stored ?? src, source_image_url: src, position: position++, category_id: categoryId,
    })
    if (!error) added++
  }
  return added
}

/**
 * De gevonden kandidaten van een merk opnieuw groeperen tot families, zonder
 * de site opnieuw te lezen.
 *   - Hoort een variant bij een collectie die al bestaat ("Glo-Ball Floor"
 *     bij Glo-Ball), dan wordt hij een product van die collectie en is de
 *     kandidaat afgehandeld.
 *   - Anders één kandidaat per familie met de varianten als producten; de
 *     losse variant-kandidaten verdwijnen.
 */
export async function regroupCandidates(sb: any, brandId: string, brandName: string): Promise<{ families: number; merged: number; addedToCollections: number }> {
  const { data: rows } = await sb.from("brand_collection_candidates")
    .select("id, name, slug, url, source_page_url, description, category_id, image_url, source_image_url, products, status, collection_id")
    .eq("brand_id", brandId).order("name")
  const cands = (rows ?? []) as CandidateRow[]
  if (!cands.some((c) => c.status === "found")) return { families: 0, merged: 0, addedToCollections: 0 }
  const groups = await groupIntoFamilies(brandName, cands.map((c) => c.name))
  const taken = new Set(cands.filter((c) => c.status !== "found").map((c) => c.slug))
  let families = 0, merged = 0, addedToCollections = 0
  const asProducts = (ms: CandidateRow[]): FamilyProduct[] => ms.flatMap((m) => [
    { name: m.name, url: m.url, image_url: m.image_url, source_image_url: m.source_image_url },
    ...(m.products ?? []),
  ])
  for (const g of groups) {
    if (g.members.length < 2) continue
    const members = g.members.map((i) => cands[i])
    const found = members.filter((m) => m.status === "found")
    if (found.length === 0) continue
    const existing = members.filter((m) => m.status !== "found" && m.collection_id)
    if (existing.length > 0) {
      // De familie is al een collectie: de varianten worden haar producten.
      // Meer collecties in één familie (Bellhop en Bellhop Glass): per
      // variant de collectie waarvan de naam het langst overeenkomt.
      const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
      const target = (m: CandidateRow) => existing
        .filter((e) => norm(m.name).startsWith(norm(e.name)))
        .sort((a, b) => b.name.length - a.name.length)[0] ?? existing[0]
      const byCollection = new Map<CandidateRow, CandidateRow[]>()
      for (const m of found) byCollection.set(target(m), [...(byCollection.get(target(m)) ?? []), m])
      for (const [col, ms] of byCollection) {
        addedToCollections += await addProductsToCollection(sb, brandId, col.collection_id!, col.category_id, asProducts(ms))
        // Opgegaan in de collectie: geen eigen kandidaat meer. Een nieuwe
        // inventarisatie vindt ze terug en voegt ze hier weer samen.
        await sb.from("brand_collection_candidates").delete().in("id", ms.map((m) => m.id)).eq("status", "found")
      }
      merged += found.length
      continue
    }
    if (found.length < 2) continue
    const slug = slugify(g.name)
    if (!slug || taken.has(slug)) continue
    const rep = found.find((m) => m.slug === slug) ?? null
    const variants = found.filter((m) => m !== rep)
    const products = [...(rep?.products ?? []), ...asProducts(variants)]
    const first = variants[0]
    if (rep) {
      await sb.from("brand_collection_candidates").update({ products }).eq("id", rep.id)
    } else {
      const { error } = await sb.from("brand_collection_candidates").insert({
        brand_id: brandId, name: g.name, slug, url: first.url, source_page_url: first.source_page_url,
        description: first.description, category_id: first.category_id,
        image_url: first.image_url, source_image_url: first.source_image_url, status: "found", products,
      })
      if (error) { logger.warn("Family candidate insert failed", { brandId, family: g.name, error: error.message }); continue }
    }
    await sb.from("brand_collection_candidates").delete().in("id", variants.map((m) => m.id)).eq("status", "found")
    taken.add(slug)
    families++
    merged += variants.length
  }
  return { families, merged, addedToCollections }
}

/**
 * Opruimen na een eerdere hergroepering die varianten als "chosen" liet staan:
 * per collectie blijft alleen de kandidaat van de collectie zelf over.
 */
export async function removeAbsorbedCandidates(sb: any, brandId: string): Promise<number> {
  const [{ data: cands }, { data: cols }] = await Promise.all([
    sb.from("brand_collection_candidates").select("id, slug, collection_id").eq("brand_id", brandId).eq("status", "chosen").not("collection_id", "is", null),
    sb.from("product_collections").select("id, slug").eq("brand_id", brandId),
  ])
  const colSlug = new Map(((cols ?? []) as Array<{ id: string; slug: string }>).map((c) => [c.id, c.slug]))
  const byCol = new Map<string, Array<{ id: string; slug: string }>>()
  for (const c of (cands ?? []) as Array<{ id: string; slug: string; collection_id: string }>) byCol.set(c.collection_id, [...(byCol.get(c.collection_id) ?? []), c])
  const remove: string[] = []
  for (const [colId, list] of byCol) {
    if (list.length < 2) continue
    const keep = list.find((c) => c.slug === colSlug.get(colId)) ?? list[0]
    remove.push(...list.filter((c) => c !== keep).map((c) => c.id))
  }
  if (remove.length) await sb.from("brand_collection_candidates").delete().in("id", remove)
  return remove.length
}
