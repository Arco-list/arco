import "server-only"

import { logger } from "@/lib/logger"

/**
 * Beeld-embeddings via Voyage AI (voyage-multimodal-3.5, 1024 dimensies;
 * migratie 333). Een vector legt vast hoe iets eruitziet, zodat een
 * uitsnede uit een projectfoto de productbeelden in de catalogus vindt die
 * er het meest op lijken (pgvector, match_product_images).
 *
 * Beelden gaan als base64 naar Voyage, niet als URL: dan maakt het niet
 * uit of de bron een content-length stuurt of robots.txt heeft, en kunnen
 * we grote beelden eerst verkleinen. Prijs: $0,60 per miljard pixels,
 * 150 miljard pixels gratis per account; een beeld telt hooguit 2 MP.
 */

export const EMBEDDING_MODEL = "voyage-multimodal-3.5"
const ENDPOINT = "https://api.voyageai.com/v1/multimodalembeddings"
const MAX_SIDE = 1024
const THUMB_SIDE = 400
const PER_REQUEST = 16

export const voyageConfigured = () => Boolean(process.env.VOYAGE_API_KEY)

export type PreparedImage = { dataUrl: string; thumb: Buffer | null }

/**
 * Een beeld ophalen en klaarmaken: jpeg voor Voyage (hooguit 1024 px, zodat
 * ook een foto van 24 MP binnen Voyage's grens valt) en een duimnagel
 * (400 px). jpeg en png via jimp; webp en gif gaan ongewijzigd mee (zonder
 * uitsnede of duimnagel). avif kan nog niet: jimp leest het niet en Voyage
 * neemt het niet aan.
 */
export async function prepareImage(url: string, options?: { crop?: { x0: number; y0: number; x1: number; y1: number }; maxSide?: number }): Promise<PreparedImage | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "Mozilla/5.0 (compatible; ArcoBot/1.0)" } })
    if (!res.ok) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.byteLength < 100) return null
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
    const decodable = type === "image/jpeg" || type === "image/png" || bytes[0] === 0xff || bytes.subarray(1, 4).toString() === "PNG"
    if (!decodable) {
      if (options?.crop || !/^image\/(webp|gif)$/.test(type) || bytes.byteLength > 15_000_000) return null
      return { dataUrl: `data:${type};base64,${bytes.toString("base64")}`, thumb: null }
    }
    const { Jimp } = await import("jimp")
    const img = await Jimp.read(bytes)
    if (options?.crop) {
      // Het kader met wat ruimte eromheen: een product zonder rand wordt
      // slechter herkend.
      const { x0, y0, x1, y1 } = options.crop
      const padX = (x1 - x0) * 0.08, padY = (y1 - y0) * 0.08
      const left = Math.max(0, Math.floor((x0 - padX) * img.width))
      const top = Math.max(0, Math.floor((y0 - padY) * img.height))
      const right = Math.min(img.width, Math.ceil((x1 + padX) * img.width))
      const bottom = Math.min(img.height, Math.ceil((y1 + padY) * img.height))
      if (right - left < 8 || bottom - top < 8) return null
      img.crop({ x: left, y: top, w: right - left, h: bottom - top })
    }
    const side = options?.maxSide ?? MAX_SIDE
    if (img.width > side || img.height > side) img.scaleToFit({ w: side, h: side })
    // Doorzichtig (png) op wit, zoals op de site van het merk.
    const flat = new Jimp({ width: img.width, height: img.height, color: 0xffffffff }).composite(img, 0, 0)
    const main = await flat.getBuffer("image/jpeg", { quality: 85 })
    flat.scaleToFit({ w: THUMB_SIDE, h: THUMB_SIDE })
    const thumb = await flat.getBuffer("image/jpeg", { quality: 80 })
    return { dataUrl: `data:image/jpeg;base64,${main.toString("base64")}`, thumb }
  } catch (err) {
    logger.warn("Image could not be prepared for embedding", { url, error: String(err) })
    return null
  }
}

/** Eén verzoek; null als Voyage een beeld in de reeks afwijst (400: ongeldig of kapot). */
async function embedRequest(key: string, chunk: string[]): Promise<number[][] | null> {
  const body = JSON.stringify({
    model: EMBEDDING_MODEL,
    inputs: chunk.map((d) => ({ content: [{ type: "image_base64", image_base64: d }] })),
    truncation: true,
  })
  // Bij een limiet (429) even wachten en opnieuw, hooguit drie keer.
  let res: Response | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(60_000),
    })
    if (res.status !== 429 || attempt === 3) break
    const wait = Number(res.headers.get("retry-after")) || 15 * (attempt + 1)
    await new Promise((r) => setTimeout(r, Math.min(wait, 60) * 1000))
  }
  if (res?.status === 400) {
    logger.warn("Voyage rejected an image", { count: chunk.length, detail: (await res.text()).slice(0, 200) })
    return null
  }
  if (!res || !res.ok) throw new Error(`Voyage ${res?.status}: ${(await res?.text())?.slice(0, 300)}`)
  const json = (await res.json()) as { data: Array<{ embedding: number[]; index: number }> }
  return [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding)
}

/**
 * Vectoren voor een reeks beelden (data-URL's), in de volgorde van de invoer.
 * Een beeld dat Voyage afwijst, krijgt null; de rest van de reeks gaat door.
 */
export async function embedImages(dataUrls: string[]): Promise<Array<number[] | null>> {
  const key = process.env.VOYAGE_API_KEY
  if (!key) throw new Error("VOYAGE_API_KEY is not configured")
  const out: Array<number[] | null> = []
  for (let i = 0; i < dataUrls.length; i += PER_REQUEST) {
    const chunk = dataUrls.slice(i, i + PER_REQUEST)
    const vectors = await embedRequest(key, chunk)
    if (vectors) { out.push(...vectors); continue }
    // Eén kapot beeld laat het hele verzoek mislukken: dan per beeld.
    for (const d of chunk) out.push(chunk.length === 1 ? null : (await embedRequest(key, [d]))?.[0] ?? null)
  }
  return out
}

/** pgvector verwacht "[0.1,0.2,…]". */
export const toVector = (v: number[]) => `[${v.join(",")}]`

type CatalogImage = { source: "product" | "product_photo" | "collection_photo"; source_id: string; product_id: string | null; collection_id: string | null; brand_id: string; category_ids: string[]; image_url: string }

/** Alle catalogusbeelden die nog geen vector hebben. */
async function missingCatalogImages(sb: any, limit: number, retryFailed = false): Promise<CatalogImage[]> {
  const all = async (q: () => any) => {
    const out: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await q().range(from, from + 999)
      if (error) throw error
      out.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return out
  }
  const [products, extras, colPhotos, kinds, collections, done] = await Promise.all([
    all(() => sb.from("products").select("id, image_url, collection_id, brand_id, category_id").not("image_url", "is", null).order("id")),
    all(() => sb.from("product_photos").select("id, url, product_id").order("id")),
    all(() => sb.from("product_collection_photos").select("id, url, collection_id").eq("kind", "product").order("id")),
    all(() => sb.from("product_collection_kinds").select("collection_id, category_id").order("collection_id")),
    all(() => sb.from("product_collections").select("id, brand_id, category_id").order("id")),
    all(() => {
      const q = sb.from("product_image_embeddings").select("source, source_id").order("id")
      return retryFailed ? q.is("failed_at", null) : q
    }),
  ])
  const have = new Set(done.map((r: any) => `${r.source}:${r.source_id}`))
  const colById = new Map(collections.map((c: any) => [c.id, c]))
  const kindsOf = new Map<string, string[]>()
  for (const k of kinds) kindsOf.set(k.collection_id, [...(kindsOf.get(k.collection_id) ?? []), k.category_id])
  const colCats = (colId: string | null) => {
    if (!colId) return []
    const c: any = colById.get(colId)
    return [...(kindsOf.get(colId) ?? []), ...(c?.category_id ? [c.category_id] : [])]
  }
  const productById = new Map(products.map((p: any) => [p.id, p]))
  const uniq = (xs: Array<string | null | undefined>) => Array.from(new Set(xs.filter((x): x is string => Boolean(x))))

  const out: CatalogImage[] = []
  for (const p of products) {
    if (have.has(`product:${p.id}`)) continue
    out.push({ source: "product", source_id: p.id, product_id: p.id, collection_id: p.collection_id, brand_id: p.brand_id, category_ids: uniq([p.category_id, ...colCats(p.collection_id)]), image_url: p.image_url })
  }
  for (const x of extras) {
    if (have.has(`product_photo:${x.id}`)) continue
    const p: any = productById.get(x.product_id)
    if (!p) continue
    out.push({ source: "product_photo", source_id: x.id, product_id: p.id, collection_id: p.collection_id, brand_id: p.brand_id, category_ids: uniq([p.category_id, ...colCats(p.collection_id)]), image_url: x.url })
  }
  for (const ph of colPhotos) {
    if (have.has(`collection_photo:${ph.id}`)) continue
    const c: any = colById.get(ph.collection_id)
    if (!c) continue
    out.push({ source: "collection_photo", source_id: ph.id, product_id: null, collection_id: c.id, brand_id: c.brand_id, category_ids: uniq(colCats(c.id)), image_url: ph.url })
  }
  return out.slice(0, limit)
}

/**
 * Catalogusbeelden zonder vector indexeren (hooguit `limit` per keer).
 * Een beeld dat niet te lezen is, krijgt een rij zonder vector (failed_at).
 */
export async function indexCatalogImages(sb: any, options?: { limit?: number; deadline?: number; /** Ook beelden die eerder mislukten. */ retryFailed?: boolean }): Promise<{ indexed: number; skipped: number; remaining: number }> {
  if (!voyageConfigured()) return { indexed: 0, skipped: 0, remaining: -1 }
  const limit = options?.limit ?? 200
  const todo = await missingCatalogImages(sb, limit, options?.retryFailed)
  let indexed = 0, skipped = 0
  for (let i = 0; i < todo.length; i += PER_REQUEST) {
    if (options?.deadline && Date.now() > options.deadline) break
    const chunk = todo.slice(i, i + PER_REQUEST)
    const prepared = await Promise.all(chunk.map((c) => prepareImage(c.image_url)))
    const ready = chunk.map((c, j) => ({ c, p: prepared[j] })).filter((x): x is { c: CatalogImage; p: PreparedImage } => Boolean(x.p))
    // Niet te lezen: vastleggen zonder vector, zodat het niet elke ronde vooraan staat.
    const unreadable = chunk.filter((_, j) => !prepared[j])
    if (unreadable.length) {
      await sb.from("product_image_embeddings").upsert(unreadable.map((c) => ({ ...c, embedding: null, model: EMBEDDING_MODEL, failed_at: new Date().toISOString() })), { onConflict: "source,source_id" })
    }
    skipped += unreadable.length
    if (ready.length === 0) continue
    const vectors = await embedImages(ready.map((x) => x.p.dataUrl))
    const rejected = ready.filter((_, j) => !vectors[j]).map((x) => x.c)
    if (rejected.length) {
      await sb.from("product_image_embeddings").upsert(rejected.map((c) => ({ ...c, embedding: null, model: EMBEDDING_MODEL, failed_at: new Date().toISOString() })), { onConflict: "source,source_id" })
      skipped += rejected.length
    }
    const accepted = ready.map((x, j) => ({ ...x, v: vectors[j] })).filter((x): x is { c: CatalogImage; p: PreparedImage; v: number[] } => Boolean(x.v))
    if (accepted.length === 0) continue
    const rows = await Promise.all(accepted.map(async ({ c, p, v }) => {
      let thumb_url: string | null = null
      if (p.thumb) {
        const path = `catalog-thumbs/${c.source}-${c.source_id}.jpg`
        const { error } = await sb.storage.from("company-assets").upload(path, p.thumb, { contentType: "image/jpeg", upsert: true, cacheControl: "31536000" })
        if (!error) thumb_url = sb.storage.from("company-assets").getPublicUrl(path).data.publicUrl
      }
      return { ...c, thumb_url, embedding: toVector(v), model: EMBEDDING_MODEL, failed_at: null }
    }))
    const { error } = await sb.from("product_image_embeddings").upsert(rows, { onConflict: "source,source_id" })
    if (error) throw error
    indexed += rows.length
  }
  const rest = await missingCatalogImages(sb, 100_000, options?.retryFailed)
  return { indexed, skipped, remaining: rest.length }
}
