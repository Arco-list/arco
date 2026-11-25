import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { pickCollectionHero } from "@/lib/products/collection-hero"

/**
 * Merk-stippen op projectfoto's (migratie 317), klaar voor de lightbox.
 *
 * Een stip met een collectie toont de collectie (foto, naam, merk); een
 * stip met alleen een merk toont het merk. De link volgt de merkenlaag:
 * die is admin-only, dus een admin gaat naar de merk- of collectiepagina
 * op Arco, een bezoeker naar de site van het merk (de collectiepagina
 * daar als we die kennen, anders de homepage).
 *
 * Naast de handmatige tags ook de goedgekeurde stippen van de
 * productherkenning (migraties 332–334): de stip in het midden van het
 * kader, met de goedgekeurde collectie of alleen het merk. Draait iemand de
 * goedkeuring terug, dan is de stip hier ook weg. Een handmatige tag voor
 * dezelfde collectie (of hetzelfde merk) op dezelfde foto gaat voor.
 */
export type PhotoBrandTag = {
  id: string
  x: number
  y: number
  title: string
  subtitle: string | null
  logoUrl: string | null
  imageUrl: string | null
  /** Pad binnen Arco (zonder taal), of een externe url. */
  href: string | null
  external: boolean
  /** Kleur van de stip (productherkenning: de toestand); zonder de huisstijl. */
  color?: string
}

export async function getPhotoBrandTags(photoIds: string[], viewerIsAdmin: boolean): Promise<Map<string, PhotoBrandTag[]>> {
  const out = new Map<string, PhotoBrandTag[]>()
  if (photoIds.length === 0) return out
  const sr = createServiceRoleSupabaseClient() as any
  const { data: rows } = await sr
    .from("project_photo_brand_tags")
    .select("id, photo_id, x, y, brand:brands(id, name, slug, logo_url, website), collection:product_collections(id, name, slug, url)")
    .in("photo_id", photoIds)
  type Row = {
    id: string; photo_id: string; x: number; y: number
    brand: { id: string; name: string; slug: string; logo_url: string | null; website: string | null } | null
    collection: { id: string; name: string; slug: string; url: string | null } | null
  }
  const tags = (rows ?? []) as Row[]

  // Goedgekeurde stippen uit de productherkenning.
  const { data: approved } = await sr
    .from("project_photo_detections")
    .select("id, photo_id, box_x0, box_y0, box_x1, box_y1")
    .in("photo_id", photoIds).eq("review_status", "approved")
  const detections = (approved ?? []) as Array<{ id: string; photo_id: string; box_x0: number; box_y0: number; box_x1: number; box_y1: number }>
  if (detections.length > 0) {
    const { data: matches } = await sr
      .from("project_photo_detection_matches")
      .select("detection_id, level, brand:brands(id, name, slug, logo_url, website), collection:product_collections(id, name, slug, url)")
      .in("detection_id", detections.map((d) => d.id)).eq("status", "approved")
    const matchOf = new Map(((matches ?? []) as any[]).map((m) => [m.detection_id, m]))
    const key = (photoId: string, brandId: string, collectionId: string | null) => `${photoId}:${brandId}:${collectionId ?? ""}`
    const manual = new Set(tags.map((t) => t.brand ? key(t.photo_id, t.brand.id, t.collection?.id ?? null) : ""))
    for (const d of detections) {
      const m = matchOf.get(d.id)
      if (!m?.brand) continue
      const collection = m.level === "brand" ? null : m.collection ?? null
      const k = key(d.photo_id, m.brand.id, collection?.id ?? null)
      if (manual.has(k)) continue
      manual.add(k)
      tags.push({ id: `det:${d.id}`, photo_id: d.photo_id, x: (d.box_x0 + d.box_x1) / 2, y: (d.box_y0 + d.box_y1) / 2, brand: m.brand, collection })
    }
  }
  if (tags.length === 0) return out

  const collectionIds = Array.from(new Set(tags.map((t) => t.collection?.id).filter((id): id is string => Boolean(id))))
  const heroByCollection = new Map<string, string>()
  if (collectionIds.length > 0) {
    const { data: photos } = await sr
      .from("product_collection_photos")
      .select("collection_id, url, is_primary, order_index, kind")
      .in("collection_id", collectionIds)
      .order("order_index")
    const grouped = new Map<string, Array<{ url: string; isPrimary: boolean; kind: string | null }>>()
    for (const p of (photos ?? []) as Array<{ collection_id: string; url: string; is_primary: boolean; kind: string | null }>) {
      grouped.set(p.collection_id, [...(grouped.get(p.collection_id) ?? []), { url: p.url, isPrimary: p.is_primary, kind: p.kind }])
    }
    for (const [id, list] of grouped) {
      const hero = pickCollectionHero(list)
      if (hero) heroByCollection.set(id, hero.url)
    }
  }

  const domainOf = (url: string | null) => {
    if (!url) return null
    try { return new URL(url).hostname.replace(/^www\./, "") } catch { return null }
  }

  for (const t of tags) {
    if (!t.brand) continue
    const c = t.collection
    const internal = c ? `/brands/${t.brand.slug}/${c.slug}` : `/brands/${t.brand.slug}`
    const externalUrl = c?.url ?? t.brand.website ?? null
    const tag: PhotoBrandTag = {
      id: t.id,
      x: Number(t.x),
      y: Number(t.y),
      title: c ? c.name : t.brand.name,
      subtitle: c ? t.brand.name : domainOf(t.brand.website),
      logoUrl: t.brand.logo_url,
      imageUrl: c ? heroByCollection.get(c.id) ?? null : null,
      href: viewerIsAdmin ? internal : externalUrl,
      external: !viewerIsAdmin,
    }
    out.set(t.photo_id, [...(out.get(t.photo_id) ?? []), tag])
  }
  return out
}
