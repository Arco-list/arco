import "server-only"

import { logger } from "@/lib/logger"
import { imageSize } from "@/lib/images/image-size"

/**
 * Gedeeld door de merkacties in admin en de achtergrondtaken voor
 * collecties (lib/collections/pipeline): slugs, adressen, beelden kopiëren
 * naar onze opslag en de omslag van een collectie bijhouden.
 */

export const stripWww = (h: string) => h.replace(/^www\./, "").toLowerCase()

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "brand"
}

/** Een absoluut http(s)-adres, opgelost tegen `base`; anders null. */
export function absoluteHttpUrl(value: string | null | undefined, base: string): string | null {
  if (!value) return null
  try {
    const u = new URL(value, base)
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null
  } catch {
    return null
  }
}

const REMOTE_IMAGE_MAX_BYTES = 15 * 1024 * 1024
export const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/svg+xml": "svg",
}

/**
 * Copy an image from a brand's site into our bucket. Everything we show
 * is ours to keep: a brand's CDN renames, resizes and disappears, and
 * a page that depends on it breaks without anyone changing anything
 * here. Returns our public url, or null when the fetch failed or the
 * response was not an image — the caller decides what to do then.
 * `name` fixes the file name (upsert) for things that exist once, like
 * a logo; otherwise the file gets a unique name.
 */
// Eerst een kale botnaam: sommige sites (Penta) breken de verbinding af bij
// alles wat "Mozilla" zegt maar niet als browser praat; daarna de
// browservariant voor sites die juist een browsernaam willen zien.
const IMAGE_USER_AGENTS = [
  "ArcoBot/1.0 (+https://www.arcolist.com)",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
]

async function fetchImage(remoteUrl: string): Promise<Response | null> {
  for (const ua of IMAGE_USER_AGENTS) {
    try {
      const res = await fetch(remoteUrl, {
        headers: { "User-Agent": ua, Accept: "image/*,*/*;q=0.8" },
        signal: AbortSignal.timeout(20000),
        redirect: "follow",
        cache: "no-store",
      })
      if (res.ok) return res
    } catch {
      // volgende identificatie
    }
  }
  return null
}

/**
 * Het hoofdbeeld van een productpagina (og:image of twitter:image): voor
 * een product dat op de collectiepagina geen beeld had maar wel een eigen
 * pagina. Gratis, één verzoek.
 */
export async function pageMainImage(pageUrl: string): Promise<string | null> {
  for (const ua of IMAGE_USER_AGENTS) {
    try {
      const res = await fetch(pageUrl, { headers: { "User-Agent": ua, Accept: "text/html" }, signal: AbortSignal.timeout(15000), redirect: "follow", cache: "no-store" })
      if (!res.ok) continue
      const html = (await res.text()).slice(0, 400_000)
      const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*>/i)
      const content = m?.[0].match(/content=["']([^"']+)["']/i)?.[1]
      if (!content) return null
      try { return new URL(content.replace(/&amp;/g, "&"), res.url || pageUrl).toString() } catch { return null }
    } catch {
      // volgende identificatie
    }
  }
  return null
}

export async function storeRemoteImage(supabase: any, remoteUrl: string, folder: string, name?: string): Promise<string | null> {
  try {
    const res = await fetchImage(remoteUrl)
    if (!res) {
      logger.warn("Remote image fetch failed", { url: remoteUrl })
      return null
    }
    let type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
    const declared = Number(res.headers.get("content-length") ?? 0)
    if (declared > REMOTE_IMAGE_MAX_BYTES) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > REMOTE_IMAGE_MAX_BYTES) return null
    // Sommige bronnen (Apollo's S3) sturen geen Content-Type: het type
    // dan uit de eerste bytes lezen.
    if (!IMAGE_EXT[type]) {
      const head = bytes.subarray(0, 12)
      if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) type = "image/png"
      else if (head[0] === 0xff && head[1] === 0xd8) type = "image/jpeg"
      else if (head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WEBP") type = "image/webp"
      else if (head.subarray(0, 3).toString("ascii") === "GIF") type = "image/gif"
      else if (bytes.subarray(0, 300).toString("utf8").includes("<svg")) type = "image/svg+xml"
    }
    const ext = IMAGE_EXT[type]
    if (!ext) return null

    const file = name ? `${name}.${ext}` : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
    const path = `${folder}/${file}`
    const { error } = await supabase.storage
      .from("company-assets")
      .upload(path, bytes, { cacheControl: "31536000", upsert: Boolean(name), contentType: type })
    if (error) {
      logger.error("Remote image upload failed", { url: remoteUrl, path }, error as any)
      return null
    }
    const { data } = supabase.storage.from("company-assets").getPublicUrl(path)
    return data?.publicUrl ?? null
  } catch (err) {
    logger.error("Remote image fetch failed", { url: remoteUrl }, err as Error)
    return null
  }
}

/** De cover is de primaire foto, anders de eerste; zonder foto's geen cover. */
/** `focus: false`: geen focuspunt zoeken (bv. bij het toevoegen van veel
 *  collecties tegelijk; het ophalen daarna zet de echte hero en zoekt dan). */
export async function syncCollectionCover(supabase: any, collectionId: string, options?: { focus?: boolean }): Promise<void> {
  const { data: primary } = await supabase
    .from("product_collection_photos")
    .select("id, url, width, height")
    .eq("collection_id", collectionId)
    .order("is_primary", { ascending: false })
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle()
  await supabase.from("product_collections").update({ hero_image_url: primary?.url ?? null }).eq("id", collectionId)
  // De maat van de omslag: de kaart heeft die nodig om het focuspunt in het
  // midden te zetten (focusPositionIn). Overzichtsbeelden uit de
  // inventarisatie komen zonder maat binnen.
  if (primary && !primary.width) await storePhotoSize(supabase, primary.id, primary.url)
  // De hero snijdt bij rond het product: een nieuwe hero krijgt een
  // focuspunt (één Claude-blik, alleen als er nog geen is).
  if (options?.focus === false) return
  try {
    const { ensureHeroFocus } = await import("@/lib/collections/hero-focus")
    await ensureHeroFocus(supabase, collectionId)
  } catch (err) {
    logger.warn("Hero focus skipped", { collectionId, error: String(err) })
  }
}

/** Breedte en hoogte van een opgeslagen collectiefoto invullen. */
export async function storePhotoSize(supabase: any, photoId: string, url: string): Promise<void> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return
    const size = imageSize(new Uint8Array(await res.arrayBuffer()))
    if (size) await supabase.from("product_collection_photos").update({ width: size.width, height: size.height }).eq("id", photoId)
  } catch { /* geen maat, geen ramp */ }
}

/**
 * Een vrije slug binnen een merk: "mito", anders "mito-2", "mito-3"… De
 * unieke sleutel op product_collections is (brand_id, slug).
 */
export function freeSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  for (let i = 2; i < 100; i++) {
    const s = `${base}-${i}`.slice(0, 80)
    if (!taken.has(s)) return s
  }
  return `${base}-${Date.now().toString(36)}`
}
