import "server-only"

import Anthropic from "@anthropic-ai/sdk"

import { logger } from "@/lib/logger"
import { indexCatalogImages, voyageConfigured } from "@/lib/recognition/embeddings"
import { tickMatching } from "@/lib/recognition/matching"
import { promptHash } from "@/lib/recognition/config"

/**
 * Productherkenning, stap 1 (Notion › Product recognition, migratie 332).
 *
 * Per projectfoto de belangrijkste producten — hooguit drie — met soort uit
 * de producttaxonomie, kader en een korte beschrijving, plus de ruimte die
 * Claude ziet. Dat zijn detecties: wat er te zien is, nog niet welk merk.
 *
 * Een foto gaat door project_photo_analyses:
 *   queued     wacht (queueProjectPhotos)
 *   submitted  zit in een batch bij Claude (Sonnet 5.5, half geld)
 *   done       detecties staan in project_photo_detections
 *   failed     Claude kon de foto niet lezen (fout in `error`)
 * De cron (/api/cron/photo-detections) roept elke minuut tickPhotoDetections
 * aan: eerst klare batches verwerken, dan wachtende foto's indienen.
 *
 * Beelden gaan als URL naar Claude als ze klein genoeg zijn; grotere
 * verkleinen we hier met jimp. Niet via de beeldtransformatie van Supabase:
 * dat quotum is op (zie autoTagPhotosWithSpaces in de import).
 */

export const DETECTION_MODEL = "claude-sonnet-5-5"
const TIME_BUDGET_MS = 200_000
/** Foto's per batch; grote foto's gaan als base64 mee, dus niet te veel. */
const MAX_PER_BATCH = 150
/** Tot deze grootte haalt Claude de foto zelf op (limiet ~5 MB). */
const URL_MAX_BYTES = 4_500_000
const MAX_DETECTIONS = 3

export const DETECTION_ROOMS = ["Living", "Kitchen", "Bathroom", "Bedroom", "Hallway", "Home Office", "Exterior", "Terrace", "Pool", "Garden", "Other"] as const

const SCHEMA = {
  type: "object",
  properties: {
    room: { type: "string", enum: [...DETECTION_ROOMS] },
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind_slug: { type: ["string", "null"] },
          label: { type: "string" },
          box: {
            type: "object",
            properties: { x0: { type: "number" }, y0: { type: "number" }, x1: { type: "number" }, y1: { type: "number" } },
            required: ["x0", "y0", "x1", "y1"],
            additionalProperties: false,
          },
          description: { type: "string" },
          brand_cues: { type: ["string", "null"] },
        },
        required: ["kind_slug", "label", "box", "description", "brand_cues"],
        additionalProperties: false,
      },
    },
  },
  required: ["room", "products"],
  additionalProperties: false,
} as const

type Detection = {
  room: string
  products: Array<{ kind_slug: string | null; label: string; box: { x0: number; y0: number; x1: number; y1: number }; description: string; brand_cues: string | null }>
}

// Dezelfde vraag als de proef (scripts/test-product-detection.ts).
const PROMPT = `This is a photo from an interior or architecture project on Arco, an editorial directory of projects, professionals and design products.

Give:
- room: the room or space the photo shows, from the list.
- products: the MAIN design products visible — the pieces from a brand's collection that a visitor would want to know the maker of: furniture (a sofa, a chair, a dining table, a bed), lighting (a pendant, a floor lamp), appliances and fittings (an oven, a hob, a tap, a boiling-water tap, a bathtub, a basin). At most 3, most prominent first.
  Do NOT include bespoke joinery and fixed finishes, even when they dominate the photo: custom kitchens and kitchen islands, cabinetry, wardrobes and shelving built into the room, worktops and countertops, splashbacks, wall and floor finishes (stone cladding, parquet, tiles), built-in mirrors, stairs and walls. Only include a kitchen when it is a recognisable product system of a kitchen brand (e.g. Bulthaup, Boffi). Also skip small decoration, tableware and glassware, plants, books and rugs that are not a designed product. Use the free places for real products instead — a tap, a stool or an oven in a kitchen photo matters more than the island it stands on.
  For each:
  - kind_slug: the most specific slug from the category list, or null if none fits;
  - label: a short name ("Pendant light");
  - box: the bounding box as fractions of the image width and height (0 = left/top, 1 = right/bottom): x0, y0, x1, y1;
  - description: a short visual description that would help find the exact product ("large white disc pendant, thin wire suspension");
  - brand_cues: any visible brand or design cue that points to a maker, or null.`

function anthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

/** De producttaxonomie als "slug — Groep › Subgroep › Soort"; gelijk voor elk verzoek, dus cachebaar. */
async function loadCategories(sb: any): Promise<{ menu: string; idBySlug: Map<string, string> }> {
  const { data } = await sb.from("product_categories").select("id, slug, name, parent_id").eq("is_active", true)
  const rows = (data ?? []) as Array<{ id: string; slug: string; name: string; parent_id: string | null }>
  const byId = new Map(rows.map((r) => [r.id, r]))
  const pathOf = (r: { name: string; parent_id: string | null }): string => {
    const parts: string[] = []
    let cur: typeof r | undefined = r
    for (let i = 0; cur && i < 6; i++) { parts.unshift(cur.name); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined }
    return parts.join(" › ")
  }
  return {
    menu: rows.map((r) => `${r.slug} — ${pathOf(r)}`).sort().join("\n"),
    idBySlug: new Map(rows.map((r) => [r.slug, r.id])),
  }
}

/**
 * De foto's van een project in de wachtrij zetten. Zonder `force` alleen
 * foto's die nog geen analyse hebben; met `force` ook opnieuw.
 */
export async function queueProjectPhotos(sb: any, projectId: string, options?: { force?: boolean }): Promise<number> {
  const { data: photos } = await sb.from("project_photos").select("id").eq("project_id", projectId)
  const ids = ((photos ?? []) as Array<{ id: string }>).map((p) => p.id)
  if (ids.length === 0) return 0
  let todo = ids
  if (!options?.force) {
    const { data: existing } = await sb.from("project_photo_analyses").select("photo_id").in("photo_id", ids)
    const have = new Set(((existing ?? []) as Array<{ photo_id: string }>).map((r) => r.photo_id))
    todo = ids.filter((id) => !have.has(id))
  }
  if (todo.length === 0) return 0
  const now = new Date().toISOString()
  const { error } = await sb.from("project_photo_analyses").upsert(
    todo.map((photo_id) => ({ photo_id, project_id: projectId, status: "queued", batch_id: null, error: null, updated_at: now })),
    { onConflict: "photo_id" },
  )
  if (error) throw error
  return todo.length
}

/** Het beeld voor Claude: als URL, of verkleind als base64 als het te groot is. */
async function imageBlock(photo: { url: string; file_size: number | null }): Promise<any | null> {
  if (photo.file_size != null && photo.file_size <= URL_MAX_BYTES) return { type: "image", source: { type: "url", url: photo.url } }
  try {
    const res = await fetch(photo.url, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.byteLength <= URL_MAX_BYTES) return { type: "image", source: { type: "url", url: photo.url } }
    const { Jimp } = await import("jimp")
    const image = await Jimp.read(bytes)
    image.scaleToFit({ w: 1568, h: 1568 })
    const jpeg = await image.getBuffer("image/jpeg", { quality: 82 })
    return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } }
  } catch (err) {
    logger.warn("Photo for detection could not be prepared", { url: photo.url, error: String(err) })
    return null
  }
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))

/** Een soort wordt automatisch verborgen na zoveel oordelen van een admin… */
const AUTO_HIDE_MIN_REVIEWS = 8
/** …waarvan minstens dit deel verwijderen was (migratie 342). */
const AUTO_HIDE_SHARE = 0.9
export const AUTO_HIDDEN = "auto-hidden"

/**
 * Soorten die admins bijna altijd verwijderen (maatwerk, afwerking): nieuwe
 * stippen daarvan worden meteen verborgen en niet gekoppeld. Alleen
 * oordelen van admins tellen; een paar keer goedkeuren zet de soort weer aan.
 */
export async function autoHiddenKinds(sb: any): Promise<Set<string>> {
  const { data } = await sb.from("detection_kind_review_stats").select("kind_slug, reviewed, hidden")
  return new Set(((data ?? []) as Array<{ kind_slug: string; reviewed: number; hidden: number }>)
    .filter((k) => Number(k.reviewed) >= AUTO_HIDE_MIN_REVIEWS && Number(k.hidden) / Number(k.reviewed) >= AUTO_HIDE_SHARE)
    .map((k) => k.kind_slug))
}

/** De instellingen die met een detectie worden opgeslagen (migratie 336). */
export const detectPipeline = () => ({ step: "detect", model: DETECTION_MODEL, maxDetections: MAX_DETECTIONS, prompt: promptHash(PROMPT, JSON.stringify(SCHEMA)) })

async function storeResult(sb: any, photo: { photo_id: string; project_id: string }, batchId: string, data: Detection, idBySlug: Map<string, string>, hiddenKinds: Set<string>): Promise<boolean> {
  // Eerst claimen: alleen als de foto nog in deze batch zit. Zo verwerken
  // twee overlappende rondes dezelfde uitkomst niet allebei.
  const { data: claimed } = await sb.from("project_photo_analyses")
    .update({ status: "done", updated_at: new Date().toISOString() })
    .eq("photo_id", photo.photo_id).eq("status", "submitted").eq("batch_id", batchId)
    .select("photo_id")
  if (!claimed?.length) return false
  // Een nieuwe analyse vervangt de onbeoordeelde detecties van deze foto.
  // Wat een admin al beoordeelde of zelf neerzette, blijft staan; een nieuwe
  // detectie op die plek (midden in een bewaard kader) slaan we over.
  await sb.from("project_photo_detections").delete().eq("photo_id", photo.photo_id).eq("source", "ai").is("review_status", null)
  const { data: kept } = await sb.from("project_photo_detections").select("rank, box_x0, box_y0, box_x1, box_y1").eq("photo_id", photo.photo_id)
  const keptRows = (kept ?? []) as Array<{ rank: number; box_x0: number; box_y0: number; box_x1: number; box_y1: number }>
  const firstRank = keptRows.reduce((m, k) => Math.max(m, k.rank), 0) + 1
  const covered = (cx: number, cy: number) => keptRows.some((k) => cx >= k.box_x0 && cx <= k.box_x1 && cy >= k.box_y0 && cy <= k.box_y1)
  const rows = (data.products ?? []).slice(0, MAX_DETECTIONS).filter((p) => {
    const cx = (p.box.x0 + p.box.x1) / 2, cy = (p.box.y0 + p.box.y1) / 2
    return !covered(cx, cy)
  }).map((p, i) => {
    const x0 = clamp01(Math.min(p.box.x0, p.box.x1)), x1 = clamp01(Math.max(p.box.x0, p.box.x1))
    const y0 = clamp01(Math.min(p.box.y0, p.box.y1)), y1 = clamp01(Math.max(p.box.y0, p.box.y1))
    const slug = p.kind_slug?.trim() || null
    return {
      photo_id: photo.photo_id, project_id: photo.project_id, rank: firstRank + i,
      category_id: slug ? idBySlug.get(slug) ?? null : null, kind_slug: slug,
      label: (p.label ?? "").trim().slice(0, 80) || "Product",
      box_x0: x0, box_y0: y0, box_x1: x1, box_y1: y1,
      description: p.description?.trim().slice(0, 300) || null,
      brand_cues: p.brand_cues?.trim().slice(0, 200) || null,
      pipeline: detectPipeline(),
      // Een soort die admins bijna altijd verwijderen: meteen verborgen en
      // niet gekoppeld (scheelt het oordeel van Claude). Terug te zetten via
      // "Ook beoordeelde tonen"; dan wordt hij alsnog gekoppeld.
      ...(slug && hiddenKinds.has(slug) ? {
        review_status: "hidden", reviewed_at: new Date().toISOString(),
        match_status: "done", match_error: `${AUTO_HIDDEN}: ${slug} wordt bijna altijd verwijderd`,
      } : {}),
    }
  })
  if (rows.length) {
    const { error } = await sb.from("project_photo_detections").insert(rows)
    if (error) throw error
  }
  const room = (DETECTION_ROOMS as readonly string[]).includes(data.room) ? data.room : null
  await sb.from("project_photo_analyses").update({ room, error: null, analyzed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("photo_id", photo.photo_id)
  return true
}

/**
 * Automatisch herkennen: projecten die live gaan (published_at, gezet door
 * trg_set_project_published_at, langs welke weg ook), vanaf deze datum.
 * Afgekeurde projecten kosten zo niets. Eerder gepubliceerde projecten
 * (backfill) gaan via "Producten herkennen" of een aparte ronde.
 */
export const AUTO_RECOGNIZE_SINCE = "2026-11-25T00:00:00Z"

/** Foto's van live projecten (sinds AUTO_RECOGNIZE_SINCE) die nog niet herkend zijn, in de wachtrij. */
export async function queuePublishedProjects(sb: any): Promise<number> {
  const { data: projects } = await sb.from("projects").select("id")
    .eq("status", "published").gte("published_at", AUTO_RECOGNIZE_SINCE).limit(500)
  const projectIds = ((projects ?? []) as Array<{ id: string }>).map((p) => p.id)
  if (projectIds.length === 0) return 0
  const { data: photos } = await sb.from("project_photos").select("id, project_id").in("project_id", projectIds).limit(10000)
  const all = (photos ?? []) as Array<{ id: string; project_id: string }>
  if (all.length === 0) return 0
  const have = new Set<string>()
  for (let i = 0; i < all.length; i += 500) {
    const { data } = await sb.from("project_photo_analyses").select("photo_id").in("photo_id", all.slice(i, i + 500).map((p) => p.id))
    for (const r of (data ?? []) as Array<{ photo_id: string }>) have.add(r.photo_id)
  }
  const todo = all.filter((p) => !have.has(p.id))
  if (todo.length === 0) return 0
  const now = new Date().toISOString()
  const { error } = await sb.from("project_photo_analyses").upsert(
    todo.map((p) => ({ photo_id: p.id, project_id: p.project_id, status: "queued", batch_id: null, error: null, updated_at: now })),
    { onConflict: "photo_id", ignoreDuplicates: true },
  )
  if (error) { logger.warn("Auto-queue of published projects failed", { error: error.message }); return 0 }
  return todo.length
}

/** Placeholder-batch tijdens het indienen; een ronde die halverwege stopt, laat hem achter. */
const CLAIM_PREFIX = "claim:"
const CLAIM_TTL_MS = 10 * 60_000

/** Een ronde: klare batches verwerken, daarna wachtende foto's indienen. */
export async function tickPhotoDetections(sb: any) {
  const deadline = Date.now() + TIME_BUDGET_MS
  const client = anthropic()
  const cats = await loadCategories(sb)
  const hiddenKinds = await autoHiddenKinds(sb)
  // Live gegane projecten: hun foto's in de wachtrij.
  await queuePublishedProjects(sb)
  let processed = 0
  let submitted = 0

  // 1. Batches die klaar zijn. Achtergelaten claims (een ronde die stopte
  //    tijdens het indienen) gaan terug in de wachtrij.
  const { data: open } = await sb.from("project_photo_analyses").select("photo_id, project_id, batch_id, updated_at").eq("status", "submitted").limit(5000)
  const byBatch = new Map<string, Array<{ photo_id: string; project_id: string }>>()
  const stale: string[] = []
  for (const r of (open ?? []) as Array<{ photo_id: string; project_id: string; batch_id: string | null; updated_at: string }>) {
    if (!r.batch_id || r.batch_id.startsWith(CLAIM_PREFIX)) {
      if (Date.now() - new Date(r.updated_at).getTime() > CLAIM_TTL_MS) stale.push(r.photo_id)
      continue
    }
    byBatch.set(r.batch_id, [...(byBatch.get(r.batch_id) ?? []), r])
  }
  if (stale.length) await sb.from("project_photo_analyses").update({ status: "queued", batch_id: null, updated_at: new Date().toISOString() }).in("photo_id", stale)
  for (const [batchId, photos] of byBatch) {
    if (Date.now() > deadline - 30_000) break
    const batch = await client.messages.batches.retrieve(batchId)
    if (batch.processing_status !== "ended") continue
    const byId = new Map(photos.map((p) => [p.photo_id, p]))
    const seen = new Set<string>()
    for await (const r of await client.messages.batches.results(batchId)) {
      const photo = byId.get(r.custom_id)
      if (!photo) continue
      seen.add(r.custom_id)
      const fail = (error: string) => sb.from("project_photo_analyses")
        .update({ status: "failed", error: error.slice(0, 500), updated_at: new Date().toISOString() })
        .eq("photo_id", photo.photo_id).in("status", ["submitted", "done"]).eq("batch_id", batchId)
      if (r.result.type !== "succeeded") { await fail(r.result.type === "errored" ? JSON.stringify((r.result as any).error ?? {}) : r.result.type); continue }
      const msg = r.result.message
      if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") { await fail(msg.stop_reason); continue }
      const text = msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("")
      try {
        if (await storeResult(sb, photo, batchId, JSON.parse(text) as Detection, cats.idBySlug, hiddenKinds)) processed++
      } catch (err) {
        await fail(String(err))
      }
    }
    // Foto's die niet in de uitkomst staan: opnieuw in de wachtrij.
    const missing = photos.filter((p) => !seen.has(p.photo_id)).map((p) => p.photo_id)
    if (missing.length) await sb.from("project_photo_analyses").update({ status: "queued", batch_id: null, updated_at: new Date().toISOString() }).in("photo_id", missing).eq("batch_id", batchId)
  }

  // 2. Wachtende foto's indienen. Eerst claimen (queued → submitted met
  //    een placeholder), zodat een overlappende ronde ze niet ook pakt.
  while (Date.now() < deadline - 60_000) {
    const { data: queued } = await sb.from("project_photo_analyses").select("photo_id").eq("status", "queued").order("created_at").limit(MAX_PER_BATCH)
    const candidates = ((queued ?? []) as Array<{ photo_id: string }>).map((r) => r.photo_id)
    if (candidates.length === 0) break
    const claim = `${CLAIM_PREFIX}${crypto.randomUUID()}`
    const { data: claimedRows } = await sb.from("project_photo_analyses")
      .update({ status: "submitted", batch_id: claim, updated_at: new Date().toISOString() })
      .in("photo_id", candidates).eq("status", "queued")
      .select("photo_id, project_id")
    const rows = (claimedRows ?? []) as Array<{ photo_id: string; project_id: string }>
    if (rows.length === 0) continue
    const { data: photoRows } = await sb.from("project_photos").select("id, url, file_size").in("id", rows.map((r) => r.photo_id))
    const photoById = new Map(((photoRows ?? []) as Array<{ id: string; url: string; file_size: number | null }>).map((p) => [p.id, p]))
    const requests: any[] = []
    const included: string[] = []
    const failed: string[] = []
    const leftover: string[] = []
    for (const r of rows) {
      if (Date.now() > deadline - 45_000) { leftover.push(r.photo_id); continue }
      const photo = photoById.get(r.photo_id)
      const block = photo ? await imageBlock(photo) : null
      if (!block) { failed.push(r.photo_id); continue }
      included.push(r.photo_id)
      requests.push({
        custom_id: r.photo_id,
        params: {
          model: DETECTION_MODEL,
          max_tokens: 4000,
          system: [{ type: "text", text: `Product categories (slug — group › subgroup › kind):\n${cats.menu}`, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: [block, { type: "text", text: PROMPT }] }],
          output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        },
      })
    }
    const now = () => new Date().toISOString()
    if (failed.length) await sb.from("project_photo_analyses").update({ status: "failed", error: "Photo could not be read", updated_at: now() }).in("photo_id", failed).eq("batch_id", claim)
    if (leftover.length) await sb.from("project_photo_analyses").update({ status: "queued", batch_id: null, updated_at: now() }).in("photo_id", leftover).eq("batch_id", claim)
    if (requests.length === 0) { if (failed.length === 0) break; continue }
    try {
      const batch = await client.messages.batches.create({ requests } as any)
      await sb.from("project_photo_analyses").update({ batch_id: batch.id, model: DETECTION_MODEL, updated_at: now() }).in("photo_id", included).eq("batch_id", claim)
      submitted += included.length
    } catch (err) {
      logger.error("Detection batch submit failed", { count: included.length }, err as any)
      await sb.from("project_photo_analyses").update({ status: "queued", batch_id: null, updated_at: now() }).in("photo_id", included).eq("batch_id", claim)
      break
    }
  }

  // 3. Koppelen aan de catalogus (stap 3, migratie 333): eerst nieuwe
  //    catalogusbeelden indexeren, dan detecties zoeken en beoordelen.
  let matching: Awaited<ReturnType<typeof tickMatching>> | null = null
  let indexed = 0
  try {
    if (voyageConfigured() && Date.now() < deadline - 90_000) indexed = (await indexCatalogImages(sb, { limit: 48, deadline: deadline - 60_000 })).indexed
    matching = await tickMatching(sb, deadline)
  } catch (err) {
    logger.error("Matching tick failed", {}, err as any)
  }

  const { count } = await sb.from("project_photo_analyses").select("photo_id", { count: "exact", head: true }).in("status", ["queued", "submitted"])
  return { processed, submitted, pending: count ?? 0, indexed, matching }
}
