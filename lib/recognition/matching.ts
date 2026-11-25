import "server-only"

import Anthropic from "@anthropic-ai/sdk"

import { logger } from "@/lib/logger"
import { EMBEDDING_MODEL, embedImages, prepareImage, toVector, voyageConfigured } from "@/lib/recognition/embeddings"
import { MATCH_CONFIG, promptHash, type MatchConfig } from "@/lib/recognition/config"

/**
 * Productherkenning, stap 3 (migratie 333): een herkend product koppelen
 * aan de catalogus.
 *
 *   1. Uitsnede van het kader → vector (Voyage).
 *   2. Zoeken op beeld binnen dezelfde soort (pgvector,
 *      match_product_images): de meest gelijkende producten/collecties.
 *      Merken die aan het project gekoppeld zijn, wegen iets zwaarder.
 *   3. De beste als kandidaten opslaan; Claude (batch) vergelijkt de
 *      uitsnede met hun productbeelden en kiest: product, collectie, alleen
 *      merk, of niets — met een zekerheid en een reden.
 *
 * Per detectie: match_status null → submitted (batch) → done / failed, of
 * no_candidates als de catalogus voor die soort (nog) niets heeft.
 *
 * De stappen zijn los geëxporteerd, zodat de testset
 * (scripts/eval-recognition.ts) precies hetzelfde meet als de cron doet.
 */

const PER_TICK = 40
const CLAIM_PREFIX = "claim:"
const CLAIM_TTL_MS = 10 * 60_000

export const JUDGE_INSTRUCTIONS = `Which candidate is the product in the photo?
- match: the candidate number, or null if none is the same design. Similar is not enough: the shape, proportions and details must match. A wrong match is worse than no match.
- level: "product" when it is that exact product (size or finish may differ), "collection" when it is clearly from that collection or family but you cannot tell which product, "brand" when you only recognise the brand's design language; null with match null.
- confidence: high, medium or low.
- reason: one short sentence on what matches or differs.
- recognized_brand, recognized_product: whether or not a candidate matches, the brand and the product (or collection / family) name you recognise in the photo — only when you are confident, otherwise null. Use the brand's own spelling, e.g. "Flos" and "Taccia".
- recognized_website: the official website of that brand (https://…), or null.`

export const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    match: { type: ["integer", "null"] },
    // Nullable enum via anyOf: een enum met null naast type string wijst de API af.
    level: { anyOf: [{ type: "string", enum: ["product", "collection", "brand"] }, { type: "null" }] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    reason: { type: "string" },
    recognized_brand: { type: ["string", "null"] },
    recognized_product: { type: ["string", "null"] },
    recognized_website: { type: ["string", "null"] },
  },
  required: ["match", "level", "confidence", "reason", "recognized_brand", "recognized_product", "recognized_website"],
  additionalProperties: false,
} as const

export type Judgement = {
  match: number | null; level: "product" | "collection" | "brand" | null; confidence: "high" | "medium" | "low"; reason: string
  recognized_brand?: string | null; recognized_product?: string | null; recognized_website?: string | null
}

/** Merknamen vergelijken zonder hoofdletters, spaties en tekens ("B&B Italia" = "b b italia"). */
export const normBrand = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "")

/** Alle merken (id, naam, logo). PostgREST geeft hooguit 1000 rijen per verzoek: in blokken lezen. */
export async function allBrands(sb: any): Promise<Array<{ id: string; name: string; logo_url: string | null }>> {
  const out: Array<{ id: string; name: string; logo_url: string | null }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("brands").select("id, name, logo_url").order("id").range(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

/** Merk-id op naam, voor wat Claude herkent of een admin intypt. */
export async function brandIdsByName(sb: any): Promise<(name: string | null | undefined) => string | null> {
  const byNorm = new Map<string, string>()
  for (const b of await allBrands(sb)) byNorm.set(normBrand(b.name), b.id)
  return (name) => (name ? byNorm.get(normBrand(name)) ?? null : null)
}

/** Hooguit eens per zoveel dagen een automatische inventarisatie per merk. */
const AUTO_INVENTORY_DAYS = 30

/**
 * Herkent Claude een product van een merk uit de selectie (ster, migratie
 * 338) dat niet in de catalogus staat, dan de collecties van dat merk
 * inventariseren — hooguit eens per 30 dagen, en niet als er al een taak
 * loopt. Het toevoegen van de gevonden collecties blijft aan een admin.
 */
export async function autoInventoryBrands(sb: any, brandIds: string[]): Promise<number> {
  const ids = Array.from(new Set(brandIds.filter(Boolean)))
  if (ids.length === 0) return 0
  const since = new Date(Date.now() - AUTO_INVENTORY_DAYS * 86_400_000).toISOString()
  const [{ data: curated }, { data: recent }, { data: active }] = await Promise.all([
    sb.from("brands").select("id").in("id", ids).eq("is_curated", true),
    sb.from("brand_collection_jobs").select("brand_id").in("brand_id", ids).eq("kind", "inventory").gte("created_at", since),
    sb.from("brand_collection_jobs").select("brand_id").in("brand_id", ids).not("stage", "in", "(done,error)"),
  ])
  const skip = new Set([...((recent ?? []) as any[]), ...((active ?? []) as any[])].map((j) => j.brand_id))
  const rows = ((curated ?? []) as Array<{ id: string }>).filter((b) => !skip.has(b.id))
    .map((b) => ({ brand_id: b.id, kind: "inventory", stage: "queued", state: { trigger: "recognition" } }))
  if (rows.length) {
    const { error } = await sb.from("brand_collection_jobs").insert(rows)
    if (error) { logger.warn("Auto inventory failed", { error: error.message }); return 0 }
  }
  return rows.length
}

/**
 * Stippen die wachten op de catalogus (review_status 'missing'): zijn er van
 * hun merk sinds de laatste koppeling nieuwe beelden geïndexeerd, dan opnieuw
 * koppelen. Het merk wordt op naam gezocht als het nog niet vastligt (een
 * merk dat later is toegevoegd).
 */
export async function requeueAwaitingCatalog(sb: any): Promise<number> {
  const { data: waiting } = await sb.from("project_photo_detections")
    .select("id, missing_brand, missing_brand_id, recognized_brand, matched_at, reviewed_at, match_status")
    .eq("review_status", "missing").limit(1000)
  const rows = ((waiting ?? []) as any[]).filter((w) => w.match_status !== "submitted")
  if (rows.length === 0) return 0
  const brandOf = await brandIdsByName(sb)
  for (const w of rows) {
    if (w.missing_brand_id) continue
    const id = brandOf(w.missing_brand) ?? brandOf(w.recognized_brand)
    if (id) { w.missing_brand_id = id; await sb.from("project_photo_detections").update({ missing_brand_id: id }).eq("id", w.id) }
  }
  const latest = new Map<string, string>()
  for (const brandId of Array.from(new Set(rows.map((w) => w.missing_brand_id).filter(Boolean))) as string[]) {
    const { data } = await sb.from("product_image_embeddings").select("created_at").eq("brand_id", brandId).not("embedding", "is", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
    if (data?.created_at) latest.set(brandId, data.created_at)
  }
  const due = rows.filter((w) => {
    const l = w.missing_brand_id ? latest.get(w.missing_brand_id) : null
    return l && new Date(l) > new Date(w.matched_at ?? w.reviewed_at ?? 0)
  }).map((w) => w.id)
  // matched_at nu: zo gaat dezelfde stip pas weer bij nóg nieuwere beelden.
  if (due.length) await sb.from("project_photo_detections").update({ match_status: null, match_batch_id: null, matched_at: new Date().toISOString() }).in("id", due)
  return due.length
}
export type Candidate = { product_id: string | null; collection_id: string | null; brand_id: string; image_url: string; similarity: number }
export type DetectionInput = { id: string; project_id: string; category_id: string; label: string; description: string | null; brand_cues: string | null }

/** De instellingen die met een voorstel worden opgeslagen. */
export const matchPipeline = (cfg: MatchConfig = MATCH_CONFIG) => ({
  step: "match", ...cfg, embeddingModel: EMBEDDING_MODEL, judgePrompt: promptHash(JUDGE_INSTRUCTIONS, JSON.stringify(JUDGE_SCHEMA)),
})

/** Een kandidaatbeeld als base64 (jpeg/png/webp/gif, hooguit 4 MB), of null. */
async function candidateImage(url: string): Promise<{ media_type: string; data: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "Mozilla/5.0 (compatible; ArcoBot/1.0)" } })
    if (!res.ok) return null
    const media_type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
    if (!/^image\/(jpeg|png|webp|gif)$/.test(media_type)) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.byteLength < 100 || bytes.byteLength > 4_000_000) return null
    return { media_type, data: bytes.toString("base64") }
  } catch {
    return null
  }
}

/**
 * Kandidaatbeelden zelf ophalen (16 tegelijk) om mee te sturen: als Claude
 * een URL niet kan downloaden (merksites blokkeren dat soms), mislukt anders
 * het hele oordeel.
 */
export async function fetchCandidateImages(urls: string[]): Promise<Map<string, { media_type: string; data: string } | null>> {
  const out = new Map<string, { media_type: string; data: string } | null>()
  const todo = Array.from(new Set(urls))
  for (let i = 0; i < todo.length; i += 16) {
    await Promise.all(todo.slice(i, i + 16).map(async (url) => out.set(url, await candidateImage(url))))
  }
  return out
}

/** Soortfilter: de soort zelf, alles eronder, en de tussenliggende soorten erboven (geen hoofdgroep). */
async function categoryFilters(sb: any): Promise<(id: string) => string[]> {
  const { data } = await sb.from("product_categories").select("id, parent_id")
  const rows = (data ?? []) as Array<{ id: string; parent_id: string | null }>
  const parent = new Map(rows.map((r) => [r.id, r.parent_id]))
  const children = new Map<string, string[]>()
  for (const r of rows) if (r.parent_id) children.set(r.parent_id, [...(children.get(r.parent_id) ?? []), r.id])
  return (id: string) => {
    const out = new Set<string>([id])
    const stack = [id]
    while (stack.length) for (const c of children.get(stack.pop()!) ?? []) { if (!out.has(c)) { out.add(c); stack.push(c) } }
    let p = parent.get(id) ?? null
    while (p && parent.get(p)) { out.add(p); p = parent.get(p) ?? null }
    return Array.from(out)
  }
}

export type MatchContext = { filterFor: (id: string) => string[]; projectBrands: Map<string, Set<string>> }

/** Soortfilters en de merken per project, voor een reeks detecties. */
export async function loadMatchContext(sb: any, projectIds: string[]): Promise<MatchContext> {
  const filterFor = await categoryFilters(sb)
  const { data: links } = projectIds.length ? await sb.from("project_brands").select("project_id, brand_id").in("project_id", projectIds) : { data: [] }
  const projectBrands = new Map<string, Set<string>>()
  for (const l of (links ?? []) as Array<{ project_id: string; brand_id: string }>) {
    projectBrands.set(l.project_id, (projectBrands.get(l.project_id) ?? new Set()).add(l.brand_id))
  }
  return { filterFor, projectBrands }
}

/**
 * Zoeken op beeld en rangschikken: merkvoorrang voor het project, één
 * kandidaat per collectie. `limit` = hoeveel er overblijven (standaard het
 * aantal dat Claude ziet; de testset vraagt er meer om te zien hoe diep de
 * juiste staat).
 */
export async function searchCandidates(sb: any, vector: string, d: { category_id: string | null; project_id: string }, ctx: MatchContext, cfg: MatchConfig = MATCH_CONFIG, limit = cfg.candidates): Promise<Candidate[]> {
  // Zonder soort (een zelf toegevoegde stip): de hele catalogus.
  const { data: found, error } = await sb.rpc("match_product_images", { query_embedding: vector, category_filter: d.category_id ? ctx.filterFor(d.category_id) : null, match_count: Math.max(cfg.searchCount, limit) })
  if (error) throw new Error(`match_product_images: ${error.message}`)
  const brands = ctx.projectBrands.get(d.project_id)
  const ranked = ((found ?? []) as Candidate[])
    .map((c) => ({ ...c, score: c.similarity + (brands?.has(c.brand_id) ? cfg.projectBrandBoost : 0) }))
    .sort((a, b) => b.score - a.score)
  const seen = new Set<string>()
  return ranked
    .filter((c) => { const k = c.collection_id ?? c.product_id ?? ""; if (seen.has(k)) return false; seen.add(k); return true })
    .slice(0, limit)
    .map(({ score: _score, ...c }) => c)
}

/** Het verzoek aan Claude: uitsnede naast de productbeelden van de kandidaten. */
export function buildJudgeParams(input: {
  d: DetectionInput
  cropBase64: string
  top: Candidate[]
  names: Awaited<ReturnType<typeof nameLookup>>
  images: Map<string, { media_type: string; data: string } | null>
  projectBrandNames: string[]
}, cfg: MatchConfig = MATCH_CONFIG) {
  const { d, cropBase64, top, names, images, projectBrandNames } = input
  return {
    model: cfg.judgeModel,
    max_tokens: 1500,
    output_config: { effort: "low", format: { type: "json_schema", schema: JUDGE_SCHEMA } },
    messages: [{
      role: "user",
      content: [
        { type: "text", text: `A product cut out of a photo from an interior or architecture project. It was described as: "${d.label}" — ${d.description ?? ""}.${d.brand_cues ? ` Visible cue: ${d.brand_cues}.` : ""}${projectBrandNames.length ? ` The project lists these brands as used: ${projectBrandNames.join(", ")}.` : ""}` },
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: cropBase64 } },
        { type: "text", text: "Candidates from our catalogue, each with a product image:" },
        ...top.flatMap((c, r) => {
          const img = images.get(c.image_url)
          return [
            { type: "text", text: `Candidate ${r + 1}: ${names.describe(c.brand_id, c.collection_id, c.product_id)}${img ? "" : " (no image available)"}` },
            ...(img ? [{ type: "image", source: { type: "base64", ...img } }] : []),
          ]
        }),
        { type: "text", text: JUDGE_INSTRUCTIONS },
      ],
    }],
  }
}

/** Het oordeel uit een antwoord; "product" kan alleen als de kandidaat een product is. */
export function parseJudgement(content: Array<{ type: string; text?: string }>, top: Array<{ product_id: string | null }>): Judgement {
  const j = JSON.parse(content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("")) as Judgement
  if (j.match != null && (j.match < 1 || j.match > top.length)) return { ...j, match: null, level: null }
  if (j.match != null && j.level === "product" && !top[j.match - 1]?.product_id) return { ...j, level: "collection" }
  return j
}

/** Een ronde: klare oordelen verwerken, daarna nieuwe detecties zoeken en indienen. */
export async function tickMatching(sb: any, deadline: number): Promise<{ judged: number; submitted: number; noCandidates: number }> {
  let judged = 0, submitted = 0, noCandidates = 0
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const cfg = MATCH_CONFIG

  // 1. Klare batches met oordelen.
  const { data: open } = await sb.from("project_photo_detections").select("id, match_batch_id, review_status").eq("match_status", "submitted").limit(5000)
  const reviewOf = new Map(((open ?? []) as Array<{ id: string; review_status: string | null }>).map((r) => [r.id, r.review_status]))
  let brandOf: ((name: string | null | undefined) => string | null) | null = null
  /** Herkend merk, product niet gevonden: die merken inventariseren. */
  const toInventory: string[] = []
  const byBatch = new Map<string, string[]>()
  for (const r of (open ?? []) as Array<{ id: string; match_batch_id: string | null }>) {
    if (!r.match_batch_id || r.match_batch_id.startsWith(CLAIM_PREFIX)) continue
    byBatch.set(r.match_batch_id, [...(byBatch.get(r.match_batch_id) ?? []), r.id])
  }
  for (const [batchId, ids] of byBatch) {
    if (Date.now() > deadline - 30_000) break
    const batch = await client.messages.batches.retrieve(batchId)
    if (batch.processing_status !== "ended") continue
    const wanted = new Set(ids)
    for await (const r of await client.messages.batches.results(batchId)) {
      if (!wanted.has(r.custom_id)) continue
      wanted.delete(r.custom_id)
      const done = (patch: Record<string, unknown>) => sb.from("project_photo_detections").update(patch).eq("id", r.custom_id).eq("match_batch_id", batchId)
      if (r.result.type !== "succeeded" || r.result.message.stop_reason === "refusal" || r.result.message.stop_reason === "max_tokens") {
        await done({ match_status: "failed", match_error: r.result.type !== "succeeded" ? r.result.type : r.result.message.stop_reason })
        continue
      }
      try {
        const { data: cands } = await sb.from("project_photo_detection_matches").select("rank, product_id").eq("detection_id", r.custom_id).eq("source", "ai").order("rank")
        const top = ((cands ?? []) as Array<{ rank: number; product_id: string | null }>)
        const j = parseJudgement(r.result.message.content as any, top)
        if (j.match != null && j.level) {
          await sb.from("project_photo_detection_matches")
            .update({ status: "suggested", level: j.level, confidence: j.confidence, reason: j.reason?.slice(0, 500) ?? null })
            .eq("detection_id", r.custom_id).eq("rank", j.match).eq("status", "candidate")
        }
        brandOf ??= await brandIdsByName(sb)
        const recognizedBrandId = brandOf(j.recognized_brand)
        if (j.match == null && recognizedBrandId && j.recognized_product) toInventory.push(recognizedBrandId)
        await done({
          match_status: "done", match_error: j.match == null ? `no match: ${j.reason?.slice(0, 300) ?? ""}` : null,
          matched_at: new Date().toISOString(),
          recognized_brand: j.recognized_brand?.trim().slice(0, 120) || null,
          recognized_product: j.recognized_product?.trim().slice(0, 160) || null,
          recognized_website: /^https?:\/\//.test(j.recognized_website ?? "") ? j.recognized_website!.trim().slice(0, 300) : null,
          recognized_brand_id: recognizedBrandId,
          // Wachtte op de catalogus en nu een voorstel: weer te beoordelen.
          ...(reviewOf.get(r.custom_id) === "missing" && j.match != null ? { review_status: null } : {}),
        })
        judged++
      } catch (err) {
        await done({ match_status: "failed", match_error: String(err).slice(0, 300) })
      }
    }
    // Niet in de uitkomst: opnieuw.
    if (wanted.size) await sb.from("project_photo_detections").update({ match_status: null, match_batch_id: null }).in("id", Array.from(wanted)).eq("match_batch_id", batchId)
  }

  await autoInventoryBrands(sb, toInventory)

  if (!voyageConfigured()) return { judged, submitted, noCandidates }

  // Achtergelaten claims terug.
  const { data: claims } = await sb.from("project_photo_detections").select("id, match_batch_id").like("match_batch_id", `${CLAIM_PREFIX}%`)
  const stale = ((claims ?? []) as Array<{ id: string; match_batch_id: string }>).filter((c) => Date.now() - Number(c.match_batch_id.split(":")[2] ?? 0) > CLAIM_TTL_MS).map((c) => c.id)
  if (stale.length) await sb.from("project_photo_detections").update({ match_status: null, match_batch_id: null }).in("id", stale)

  // Wachtend op de catalogus en er zijn nieuwe beelden van dat merk: opnieuw.
  await requeueAwaitingCatalog(sb)

  // 2. Nieuwe detecties: claimen, uitsnede, zoeken, kandidaten, indienen.
  if (Date.now() > deadline - 60_000) return { judged, submitted, noCandidates }
  const { data: fresh } = await sb.from("project_photo_detections").select("id").is("match_status", null).order("created_at").limit(PER_TICK)
  const freshIds = ((fresh ?? []) as Array<{ id: string }>).map((d) => d.id)
  if (freshIds.length === 0) return { judged, submitted, noCandidates }
  const claim = `${CLAIM_PREFIX}${crypto.randomUUID()}:${Date.now()}`
  const { data: claimed } = await sb.from("project_photo_detections")
    .update({ match_status: "submitted", match_batch_id: claim })
    .in("id", freshIds).is("match_status", null)
    .select("id, photo_id, project_id, rank, category_id, source, label, description, brand_cues, box_x0, box_y0, box_x1, box_y1")
  const dets = (claimed ?? []) as any[]
  if (dets.length === 0) return { judged, submitted, noCandidates }

  const ctx = await loadMatchContext(sb, Array.from(new Set(dets.map((d) => d.project_id))))
  const { data: photos } = await sb.from("project_photos").select("id, url").in("id", Array.from(new Set(dets.map((d) => d.photo_id))))
  const photoUrl = new Map(((photos ?? []) as Array<{ id: string; url: string }>).map((p) => [p.id, p.url]))

  const release = (ids: string[], patch: Record<string, unknown>) => ids.length ? sb.from("project_photo_detections").update(patch).in("id", ids).eq("match_batch_id", claim) : null

  // Zonder soort valt er niet gericht te zoeken; een zelf getekend kader
  // (geen soort) zoekt in de hele catalogus.
  const withKind = dets.filter((d) => d.category_id || d.source === "manual")
  await release(dets.filter((d) => !d.category_id && d.source !== "manual").map((d) => d.id), { match_status: "no_candidates", match_batch_id: null })
  noCandidates += dets.length - withKind.length

  // Uitsneden en hun vectoren.
  const crops = await Promise.all(withKind.map((d) => {
    const url = photoUrl.get(d.photo_id)
    return url ? prepareImage(url, { crop: { x0: d.box_x0, y0: d.box_y0, x1: d.box_x1, y1: d.box_y1 }, maxSide: 768 }) : Promise.resolve(null)
  }))
  const ready = withKind.map((d, i) => ({ d, crop: crops[i] })).filter((x) => x.crop)
  await release(withKind.filter((_, i) => !crops[i]).map((d) => d.id), { match_status: "failed", match_batch_id: null, match_error: "crop failed" })
  if (ready.length === 0) return { judged, submitted, noCandidates }
  let vectors: Array<number[] | null>
  try {
    vectors = await embedImages(ready.map((x) => x.crop!.dataUrl))
  } catch (err) {
    logger.error("Crop embedding failed", { count: ready.length }, err as any)
    await release(ready.map((x) => x.d.id), { match_status: null, match_batch_id: null })
    return { judged, submitted, noCandidates }
  }

  // Zoeken en kandidaten opslaan.
  const pipeline = matchPipeline(cfg)
  const searched: Array<{ d: any; crop: NonNullable<(typeof ready)[number]["crop"]>; top: Candidate[] }> = []
  for (const [i, { d, crop }] of ready.entries()) {
    const v = vectors[i]
    if (!v) { await release([d.id], { match_status: "failed", match_batch_id: null, match_error: "embedding rejected" }); continue }
    const vector = toVector(v)
    await sb.from("project_photo_detections").update({ embedding: vector }).eq("id", d.id)
    let top: Candidate[]
    try {
      top = await searchCandidates(sb, vector, d, ctx, cfg)
    } catch (err) {
      logger.warn("match_product_images failed", { detection: d.id, error: String(err) })
      await release([d.id], { match_status: null, match_batch_id: null })
      continue
    }
    await sb.from("project_photo_detection_matches").delete().eq("detection_id", d.id).eq("source", "ai")
    if (top.length === 0) { await release([d.id], { match_status: "no_candidates", match_batch_id: null }); noCandidates++; continue }
    await sb.from("project_photo_detection_matches").insert(top.map((c, r) => ({
      detection_id: d.id, rank: r + 1, collection_id: c.collection_id, product_id: c.product_id, brand_id: c.brand_id,
      image_url: c.image_url, similarity: c.similarity, status: "candidate", pipeline,
    })))
    searched.push({ d, crop: crop!, top })
  }

  // Oordeel van Claude.
  const names = await nameLookup(sb, {
    brandIds: [...searched.flatMap((x) => x.top.map((c) => c.brand_id)), ...searched.flatMap((x) => Array.from(ctx.projectBrands.get(x.d.project_id) ?? []))],
    collectionIds: searched.flatMap((x) => x.top.map((c) => c.collection_id)),
    productIds: searched.flatMap((x) => x.top.map((c) => c.product_id)),
  })
  const images = await fetchCandidateImages(searched.flatMap((x) => x.top.map((c) => c.image_url)))
  const requests = searched.map(({ d, crop, top }) => ({
    custom_id: d.id,
    params: buildJudgeParams({
      d, cropBase64: crop.dataUrl.split(",")[1], top, names, images,
      projectBrandNames: Array.from(ctx.projectBrands.get(d.project_id) ?? []).map((id) => names.brand(id)).filter(Boolean),
    }, cfg),
  }))
  const submittedIds = searched.map((x) => x.d.id)
  if (requests.length === 0) return { judged, submitted, noCandidates }
  try {
    const batch = await client.messages.batches.create({ requests } as any)
    await sb.from("project_photo_detections").update({ match_status: "submitted", match_batch_id: batch.id, match_error: null }).in("id", submittedIds).eq("match_batch_id", claim)
    submitted += submittedIds.length
  } catch (err) {
    logger.error("Judge batch submit failed", { count: submittedIds.length }, err as any)
    await release(submittedIds, { match_status: null, match_batch_id: null })
  }
  return { judged, submitted, noCandidates }
}

/** Namen van merken, collecties en producten voor de kandidatenregels. */
export async function nameLookup(sb: any, ids: { brandIds: Array<string | null>; collectionIds: Array<string | null>; productIds: Array<string | null> }) {
  const uniq = (xs: Array<string | null>) => Array.from(new Set(xs.filter((x): x is string => Boolean(x))))
  const brandIds = uniq(ids.brandIds), colIds = uniq(ids.collectionIds), prodIds = uniq(ids.productIds)
  const [{ data: brands }, { data: cols }, { data: prods }] = await Promise.all([
    brandIds.length ? sb.from("brands").select("id, name").in("id", brandIds) : { data: [] },
    colIds.length ? sb.from("product_collections").select("id, name, designer").in("id", colIds) : { data: [] },
    prodIds.length ? sb.from("products").select("id, name, variants").in("id", prodIds) : { data: [] },
  ])
  const brand = new Map(((brands ?? []) as any[]).map((b) => [b.id, b.name as string]))
  const col = new Map(((cols ?? []) as any[]).map((c) => [c.id, c]))
  const prod = new Map(((prods ?? []) as any[]).map((p) => [p.id, p]))
  return {
    brand: (id: string) => brand.get(id) ?? "",
    describe: (brandId: string, colId: string | null, prodId: string | null) => {
      const c: any = colId ? col.get(colId) : null
      const p: any = prodId ? prod.get(prodId) : null
      return [
        brand.get(brandId) ?? "Unknown brand",
        c ? `collection "${c.name}"${c.designer ? ` by ${c.designer}` : ""}` : null,
        p && p.name !== c?.name ? `product "${p.name}"` : null,
        p?.variants ? `(${p.variants})` : null,
      ].filter(Boolean).join(" — ")
    },
  }
}
