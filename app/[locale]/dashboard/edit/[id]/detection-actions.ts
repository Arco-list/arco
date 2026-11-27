"use server"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { queueProjectPhotos } from "@/lib/recognition/photo-detections"
import { OWNER_REVIEW_ENABLED } from "@/lib/recognition/flags"
import { releaseHeldLiveEmails } from "@/lib/projects/live-email"
import { cosine, groupDetections, MAYBE_SAME_SIMILARITY, parseVector } from "@/lib/recognition/grouping"
import { randomUUID } from "node:crypto"
import { createSuggestedBrand } from "@/lib/brands/suggested"
import { pickCollectionHero } from "@/lib/products/collection-hero"
import { allBrands, autoInventoryBrands, brandIdsByName } from "@/lib/recognition/matching"
import { addBrandFromSite } from "@/app/admin/brands/actions"
import { startCollectionInventory } from "@/app/admin/brands/collection-actions"

/**
 * Productherkenning in de projecteditor (migraties 332–334): de herkende
 * producten als stippen op de fototegels en de beoordeling ervan. Voorlopig
 * alleen voor admins.
 */

export type MatchLevel = "product" | "collection" | "brand"
export type ReviewStatus = "approved" | "rejected" | "missing" | "hidden" | "unknown"

/** Een kandidaat uit de catalogus (op beeld gevonden, of zelf gekozen). */
export type DetectionCandidate = {
  matchId: string
  rank: number
  source: "ai" | "manual"
  status: "candidate" | "suggested" | "approved" | "rejected"
  level: MatchLevel | null
  confidence: "high" | "medium" | "low" | null
  reason: string | null
  similarity: number | null
  brandId: string
  brandName: string
  brandSlug: string
  brandLogoUrl: string | null
  collectionId: string | null
  collectionName: string | null
  collectionSlug: string | null
  productId: string | null
  productName: string | null
  imageUrl: string | null
  /** De hero van de collectie, zoals de merkstip op de projectpagina hem toont. */
  heroUrl: string | null
}

export type PhotoDetection = {
  id: string
  photoId: string
  rank: number
  /** De plek van de stip (0–1): op het product (migratie 346), anders het midden van het kader. */
  x: number
  y: number
  box: { x0: number; y0: number; x1: number; y1: number }
  label: string
  kindSlug: string | null
  kindName: string | null
  description: string | null
  brandCues: string | null
  source: "ai" | "manual"
  /** null: nog te beoordelen. */
  reviewStatus: ReviewStatus | null
  missingBrand: string | null
  missingName: string | null
  /** Het goedgekeurde voorstel, anders (zolang niet beoordeeld) dat van Claude. */
  suggestion: {
    level: MatchLevel
    confidence: "high" | "medium" | "low" | null
    reason: string | null
    status: "suggested" | "approved"
    brandName: string
    brandSlug: string
    brandLogoUrl: string | null
    collectionName: string | null
    collectionSlug: string | null
    productName: string | null
    imageUrl: string | null
  } | null
  candidates: DetectionCandidate[]
  /** Hoe ver het koppelen is: null (nog niet), submitted, done, failed, no_candidates. */
  matchStatus: string | null
  /** Waarom Claude geen kandidaat koos, of wat er misging. */
  matchNote: string | null
  /** Hetzelfde product op meerdere foto's: stippen met hetzelfde groupId (lib/recognition/grouping). */
  groupId: string
  /** Zelf gekoppeld als hetzelfde product (migratie 345); los te koppelen. */
  linked: boolean
  /** Waarom verwijderd, als een admin dat aangaf (migratie 348). */
  hiddenReason: HideReason | null
  /** Misschien hetzelfde product: stippen op andere foto's die er redelijk op lijken, beste eerst. */
  maybeSame: string[]
  /**
   * Wat Claude herkent, ook als het niet in de catalogus staat (migratie 337):
   * merk, product, de site van het merk, en het merk in de catalogus als het
   * er al is (met een lopende inventarisatie).
   */
  recognized: {
    brand: string | null
    product: string | null
    website: string | null
    brandId: string | null
    brandName: string | null
    brandLogoUrl: string | null
    /** Het merk staat in de selectie (ster, migratie 338). */
    brandCurated: boolean
    /** Er loopt een inventarisatie of ophaaltaak voor dit merk. */
    inventoryRunning: boolean
  } | null
}

export type DetectionStatus = {
  total: number
  done: number
  pending: number
  failed: number
  /** Detecties die nog gekoppeld worden. */
  matching: number
  /** Producten die nog beoordeeld moeten worden: groepen, niet stippen. */
  toReview: number
}

type Reviewer = { userId: string; role: "admin" | "owner" }

/**
 * Mag deze gebruiker de stippen van dit project beoordelen? Admins altijd;
 * de eigenaar van het project (de maker, of iemand van het bedrijf dat
 * eigenaar is — dezelfde regel als de editor) pas als OWNER_REVIEW_ENABLED.
 */
async function requireProjectAccess(projectId: string): Promise<Reviewer | { error: string }> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Je moet ingelogd zijn." }
  const { data: profile } = await supabase.from("profiles").select("user_types, admin_role").eq("id", user.id).maybeSingle()
  if (isAdminUser(profile?.user_types, profile?.admin_role)) return { userId: user.id, role: "admin" }
  if (!OWNER_REVIEW_ENABLED) return { error: "Alleen voor admins." }
  const sb = createServiceRoleSupabaseClient() as any
  const { data: project } = await sb.from("projects").select("client_id").eq("id", projectId).maybeSingle()
  if (!project) return { error: "Project niet gevonden." }
  if (project.client_id === user.id) return { userId: user.id, role: "owner" }
  const [{ data: pros }, { data: owned }, { data: contacts }] = await Promise.all([
    sb.from("professionals").select("company_id").eq("user_id", user.id),
    sb.from("companies").select("id").eq("owner_id", user.id),
    sb.from("company_contacts").select("company_id, person:persons!inner(auth_user_id)").eq("person.auth_user_id", user.id).in("role", ["owner", "admin", "member"]).eq("status", "active"),
  ])
  const companyIds = Array.from(new Set([
    ...((pros ?? []) as any[]).map((r) => r.company_id),
    ...((owned ?? []) as any[]).map((r) => r.id),
    ...((contacts ?? []) as any[]).map((r) => r.company_id),
  ].filter(Boolean)))
  if (companyIds.length) {
    const { data: link } = await sb.from("project_professionals").select("id").eq("project_id", projectId).in("company_id", companyIds).eq("is_project_owner", true).limit(1)
    if (link?.length) return { userId: user.id, role: "owner" }
  }
  return { error: "Geen toegang tot dit project." }
}

/** Zoeken in de catalogus (merken, collecties): admins, en eigenaren zodra het aan staat. */
async function requireReviewer(): Promise<Reviewer | { error: string }> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Je moet ingelogd zijn." }
  const { data: profile } = await supabase.from("profiles").select("user_types, admin_role").eq("id", user.id).maybeSingle()
  if (isAdminUser(profile?.user_types, profile?.admin_role)) return { userId: user.id, role: "admin" }
  return OWNER_REVIEW_ENABLED ? { userId: user.id, role: "owner" } : { error: "Alleen voor admins." }
}

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Je moet ingelogd zijn." }
  const { data: profile } = await supabase.from("profiles").select("user_types, admin_role").eq("id", user.id).maybeSingle()
  if (!isAdminUser(profile?.user_types, profile?.admin_role)) return { error: "Alleen voor admins." }
  return { userId: user.id }
}

const toCandidate = (m: any): DetectionCandidate | null => {
  if (!m.brands) return null
  return {
    matchId: m.id, rank: m.rank, source: m.source, status: m.status, level: m.level ?? null,
    confidence: m.confidence ?? null, reason: m.reason ?? null, similarity: m.similarity ?? null,
    brandId: m.brand_id, brandName: m.brands.name, brandSlug: m.brands.slug, brandLogoUrl: m.brands.logo_url ?? null,
    collectionId: m.collection_id ?? null, collectionName: m.product_collections?.name ?? null, collectionSlug: m.product_collections?.slug ?? null,
    productId: m.product_id ?? null, productName: m.products?.name ?? null,
    imageUrl: m.products?.image_url ?? m.image_url ?? m.product_collections?.hero_image_url ?? null,
    heroUrl: null,
  }
}

/** De detecties en de voortgang van een project. */
export async function getPhotoDetections(projectId: string): Promise<{ detections: PhotoDetection[]; status: DetectionStatus } | { error: string }> {
  const guard = await requireProjectAccess(projectId)
  if ("error" in guard) return guard
  const sb = createServiceRoleSupabaseClient() as any
  const [{ data: rows }, { data: analyses }, { count: total }] = await Promise.all([
    sb.from("project_photo_detections")
      .select("id, photo_id, rank, label, kind_slug, description, brand_cues, box_x0, box_y0, box_x1, box_y1, match_status, match_error, source, review_status, missing_brand, missing_name, missing_brand_id, recognized_brand, recognized_product, recognized_website, recognized_brand_id, category_id, embedding, same_product_key, dot_x, dot_y, hidden_reason, product_categories(name, name_nl)")
      .eq("project_id", projectId).order("rank"),
    sb.from("project_photo_analyses").select("status").eq("project_id", projectId),
    sb.from("project_photos").select("id", { count: "exact", head: true }).eq("project_id", projectId),
  ])
  const detectionIds = ((rows ?? []) as any[]).map((r) => r.id)
  const matchRows: any[] = []
  for (let i = 0; i < detectionIds.length; i += 100) {
    const { data } = await sb.from("project_photo_detection_matches")
      .select("id, detection_id, rank, status, level, confidence, reason, similarity, source, image_url, brand_id, collection_id, product_id, brands(name, slug, logo_url), product_collections(name, slug, hero_image_url), products(name, image_url)")
      .in("detection_id", detectionIds.slice(i, i + 100)).order("rank")
    matchRows.push(...(data ?? []))
  }
  // De hero per collectie: dezelfde regel als de merkstip op de projectpagina
  // (lib/projects/photo-brand-tags), zodat de kaart hetzelfde beeld toont.
  const heroOf = new Map<string, string>()
  const colIds = Array.from(new Set(matchRows.map((m) => m.collection_id).filter(Boolean))) as string[]
  for (let i = 0; i < colIds.length; i += 100) {
    const { data: cphotos } = await sb.from("product_collection_photos")
      .select("collection_id, url, is_primary, order_index, kind").in("collection_id", colIds.slice(i, i + 100)).order("order_index")
    const grouped = new Map<string, Array<{ url: string; isPrimary: boolean; kind: string | null }>>()
    for (const p of (cphotos ?? []) as Array<{ collection_id: string; url: string; is_primary: boolean; kind: string | null }>) {
      grouped.set(p.collection_id, [...(grouped.get(p.collection_id) ?? []), { url: p.url, isPrimary: p.is_primary, kind: p.kind }])
    }
    for (const [id, list] of grouped) { const hero = pickCollectionHero(list); if (hero) heroOf.set(id, hero.url) }
  }
  const candidatesOf = new Map<string, DetectionCandidate[]>()
  for (const m of matchRows) {
    const c = toCandidate(m)
    if (!c) continue
    c.heroUrl = (c.collectionId ? heroOf.get(c.collectionId) : null) ?? null
    candidatesOf.set(m.detection_id, [...(candidatesOf.get(m.detection_id) ?? []), c])
  }
  // Hetzelfde product op meerdere foto's.
  const targetKey = (c: DetectionCandidate | undefined) => !c ? null
    : c.level === "brand" ? `brand:${c.brandId}` : c.collectionId ? `collection:${c.collectionId}` : c.productId ? `product:${c.productId}` : `brand:${c.brandId}`
  const groupInputs = ((rows ?? []) as any[]).map((r) => {
    const cands = candidatesOf.get(r.id) ?? []
    const approved = cands.find((c) => c.status === "approved")
    const target = r.review_status ? targetKey(approved) : targetKey(cands.find((c) => c.status === "suggested"))
    const outcome = !r.review_status ? null
      : r.review_status === "approved" ? `approved:${target}`
      : r.review_status === "missing" ? `missing:${(r.missing_brand ?? "").toLowerCase()}:${(r.missing_name ?? "").toLowerCase()}`
      : r.review_status
    return { id: r.id, kind: r.category_id ?? r.kind_slug ?? null, reviewed: Boolean(r.review_status), target, outcome, vector: parseVector(r.embedding), key: r.same_product_key ?? null }
  })
  const groupOf = groupDetections(groupInputs)
  // Misschien hetzelfde product (zelf te bevestigen): op een andere foto, niet
  // al in de groep, niet verborgen, dezelfde soort, en redelijk gelijkend.
  const photoOf = new Map(((rows ?? []) as any[]).map((r) => [r.id, r.photo_id]))
  const hiddenIds = new Set(((rows ?? []) as any[]).filter((r) => r.review_status === "hidden").map((r) => r.id))
  const maybeSameOf = new Map<string, string[]>()
  for (const a of groupInputs) {
    if (!a.vector || hiddenIds.has(a.id)) continue
    const hits: Array<{ id: string; sim: number }> = []
    for (const b of groupInputs) {
      if (b.id === a.id || !b.vector || hiddenIds.has(b.id)) continue
      if (photoOf.get(b.id) === photoOf.get(a.id) || groupOf.get(b.id) === groupOf.get(a.id)) continue
      if (a.kind && b.kind && a.kind !== b.kind) continue
      const sim = cosine(a.vector, b.vector)
      if (sim >= MAYBE_SAME_SIMILARITY) hits.push({ id: b.id, sim })
    }
    if (hits.length) maybeSameOf.set(a.id, hits.sort((x, y) => y.sim - x.sim).slice(0, 4).map((h) => h.id))
  }
  // Herkende merken (of het merk waarop een stip wacht) en hun inventarisatie.
  const recBrandIds = Array.from(new Set(((rows ?? []) as any[]).flatMap((r) => [r.recognized_brand_id, r.missing_brand_id]).filter(Boolean))) as string[]
  const [{ data: recBrands }, { data: recJobs }] = recBrandIds.length
    ? await Promise.all([
        sb.from("brands").select("id, name, logo_url, is_curated").in("id", recBrandIds),
        sb.from("brand_collection_jobs").select("brand_id").in("brand_id", recBrandIds).not("stage", "in", "(done,error)"),
      ])
    : [{ data: [] }, { data: [] }]
  const recBrand = new Map(((recBrands ?? []) as any[]).map((b) => [b.id, b]))
  const runningJob = new Set(((recJobs ?? []) as any[]).map((j) => j.brand_id))
  const detections: PhotoDetection[] = ((rows ?? []) as any[]).map((r) => {
    const candidates = candidatesOf.get(r.id) ?? []
    const recBrandId: string | null = r.missing_brand_id ?? r.recognized_brand_id ?? null
    const rb: any = recBrandId ? recBrand.get(recBrandId) : null
    const shown = candidates.find((c) => c.status === "approved") ?? (r.review_status ? null : candidates.find((c) => c.status === "suggested"))
    return {
      id: r.id,
      photoId: r.photo_id,
      rank: r.rank,
      // De plek die Claude op het product koos (migratie 346), anders het midden.
      x: r.dot_x ?? (r.box_x0 + r.box_x1) / 2,
      y: r.dot_y ?? (r.box_y0 + r.box_y1) / 2,
      box: { x0: r.box_x0, y0: r.box_y0, x1: r.box_x1, y1: r.box_y1 },
      label: r.label,
      kindSlug: r.kind_slug,
      kindName: r.product_categories ? (r.product_categories.name_nl ?? r.product_categories.name) : null,
      description: r.description,
      brandCues: r.brand_cues,
      source: r.source ?? "ai",
      reviewStatus: r.review_status ?? null,
      missingBrand: r.missing_brand ?? null,
      missingName: r.missing_name ?? null,
      matchStatus: r.match_status ?? null,
      matchNote: r.match_error ? String(r.match_error).replace(/^no match:\s*/, "") : null,
      groupId: groupOf.get(r.id) ?? r.id,
      linked: Boolean(r.same_product_key),
      hiddenReason: r.hidden_reason ?? null,
      maybeSame: maybeSameOf.get(r.id) ?? [],
      recognized: r.recognized_brand || r.recognized_product || r.missing_brand ? {
        brand: r.missing_brand ?? r.recognized_brand ?? null,
        product: r.missing_name ?? r.recognized_product ?? null,
        website: r.recognized_website ?? null,
        brandId: recBrandId, brandName: rb?.name ?? null, brandLogoUrl: rb?.logo_url ?? null,
        brandCurated: rb ? rb.is_curated !== false : true,
        inventoryRunning: recBrandId ? runningJob.has(recBrandId) : false,
      } : null,
      candidates,
      suggestion: shown && shown.level ? {
        level: shown.level, confidence: shown.confidence, reason: shown.reason, status: shown.status === "approved" ? "approved" : "suggested",
        brandName: shown.brandName, brandSlug: shown.brandSlug, brandLogoUrl: shown.brandLogoUrl,
        collectionName: shown.level === "brand" ? null : shown.collectionName,
        collectionSlug: shown.level === "brand" ? null : shown.collectionSlug,
        productName: shown.level === "product" ? shown.productName : null,
        imageUrl: shown.imageUrl,
      } : null,
    }
  })
  const statuses = ((analyses ?? []) as Array<{ status: string }>).map((a) => a.status)
  return {
    detections,
    status: {
      total: total ?? 0,
      done: statuses.filter((s) => s === "done").length,
      pending: statuses.filter((s) => s === "queued" || s === "submitted").length,
      failed: statuses.filter((s) => s === "failed").length,
      matching: detections.filter((d) => d.matchStatus === "submitted").length,
      // Pas na het koppelen (zelf toegevoegde stippen staan meteen op done);
      // hetzelfde product op meerdere foto's telt één keer.
      toReview: new Set(detections.filter((d) => !d.reviewStatus && d.matchStatus !== null && d.matchStatus !== "submitted").map((d) => d.groupId)).size,
    },
  }
}

/** Foto's van het project laten analyseren; `force` doet ook al geanalyseerde foto's opnieuw. */
export async function requestPhotoDetections(projectId: string, force = false): Promise<{ queued: number } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const sb = createServiceRoleSupabaseClient() as any
  try {
    return { queued: await queueProjectPhotos(sb, projectId, { force }) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Beoordelen ──────────────────────────────────────────────────────────

export type CatalogTarget = { kind: MatchLevel; id: string }

/** Waarom een stip weg moet (migratie 348); de keuzes in de kaart, alleen voor admins. */
export type HideReason = "not_prominent" | "bespoke" | "not_carried" | "duplicate" | "wrong_box" | "not_high_end" | "other"
const HIDE_REASONS = new Set<HideReason>(["not_prominent", "bespoke", "not_carried", "duplicate", "wrong_box", "not_high_end", "other"])

export type ReviewAction =
  /** Deze kandidaat klopt (eventueel op een ander niveau). */
  | { type: "approve"; matchId: string; level?: MatchLevel }
  /** Zelf gekozen uit de catalogus. */
  | { type: "pick"; target: CatalogTarget }
  /** Geen van de voorstellen klopt. */
  | { type: "reject" }
  /** Staat (nog) niet in de catalogus. */
  | { type: "missing"; brand: string; name: string }
  /** Verwijderen (verbergen); een admin kan zeggen waarom (migratie 348). */
  | { type: "hide"; reason?: HideReason | null }
  /** Wel een product, maar niet duidelijk welk (migratie 340). */
  | { type: "unknown" }
  /** Terug naar "te beoordelen". */
  | { type: "reset" }
  | { type: "level"; level: MatchLevel }
  /** De stip verplaatsen (het kader schuift mee). */
  | { type: "move"; x: number; y: number }
  /** Het kader aanpassen (0–1); de stip blijft erbinnen. */
  | { type: "box"; x0: number; y0: number; x1: number; y1: number }
  /** Alleen een zelf toegevoegde stip. */
  | { type: "delete" }

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Kan de match op dit niveau? Product vraagt een product, collectie een collectie. */
const levelFits = (m: { product_id: string | null; collection_id: string | null }, level: MatchLevel) =>
  level === "brand" || (level === "collection" ? Boolean(m.collection_id) : Boolean(m.product_id))

/** De toestand van een detectie voor het logboek: oordeel, kader en de getoonde/goedgekeurde voorstellen. */
async function snapshot(sb: any, detectionId: string) {
  const [{ data: d }, { data: ms }] = await Promise.all([
    sb.from("project_photo_detections").select("review_status, missing_brand, missing_name, box_x0, box_y0, box_x1, box_y1").eq("id", detectionId).maybeSingle(),
    sb.from("project_photo_detection_matches")
      .select("id, rank, source, status, level, confidence, similarity, brand_id, collection_id, product_id, pipeline")
      .eq("detection_id", detectionId).in("status", ["suggested", "approved"]),
  ])
  if (!d) return null
  return {
    reviewStatus: d.review_status, missingBrand: d.missing_brand, missingName: d.missing_name,
    box: { x0: d.box_x0, y0: d.box_y0, x1: d.box_x1, y1: d.box_y1 },
    matches: ms ?? [],
  }
}

/** Elke beoordeling in het logboek (migratie 336); het oordeel in de detectie zelf wordt overschreven. */
async function logReview(sb: any, entry: { detectionId: string; projectId: string; photoId: string; action: string; payload: Record<string, unknown>; before: unknown; after: unknown; userId: string; role?: "admin" | "owner" }) {
  const { error } = await sb.from("project_photo_detection_reviews").insert({
    detection_id: entry.action === "delete" ? null : entry.detectionId, project_id: entry.projectId, photo_id: entry.photoId,
    action: entry.action, payload: { ...entry.payload, detectionId: entry.detectionId, role: entry.role ?? "admin" }, before: entry.before, after: entry.after, reviewed_by: entry.userId,
  })
  if (error) console.error("Review log failed", error.message)
}

/** Acties die ook voor de andere (nog open) stippen van hetzelfde product mogen gelden. */
const GROUP_ACTIONS = new Set<ReviewAction["type"]>(["approve", "pick", "reject", "missing", "hide", "unknown"])

/**
 * Een oordeel over één stip; met `alsoIds` ook over de andere stippen van
 * hetzelfde product op andere foto's. Die krijgen hetzelfde oordeel, maar
 * alleen als ze nog niet beoordeeld zijn: een eerder oordeel blijft staan.
 */
export async function reviewDetection(detectionId: string, action: ReviewAction, alsoIds: string[] = []): Promise<{ ok: true; applied: number; liveEmailSent?: boolean } | { error: string }> {
  const sb = createServiceRoleSupabaseClient() as any
  const cols = "id, project_id, photo_id, source, review_status, box_x0, box_y0, box_x1, box_y1, dot_x, dot_y"
  const { data: det } = await sb.from("project_photo_detections").select(cols).eq("id", detectionId).maybeSingle()
  if (!det) return { error: "Product niet gevonden." }
  const guard = await requireProjectAccess(det.project_id)
  if ("error" in guard) return guard
  // Een reden bij verwijderen geeft alleen een admin; een onbekende telt niet.
  if (action.type === "hide") {
    action = { type: "hide", reason: guard.role === "admin" && action.reason && HIDE_REASONS.has(action.reason) ? action.reason : null }
  }
  const before = await snapshot(sb, detectionId)
  const result = await applyReview(sb, det, detectionId, action, guard.userId)
  if ("error" in result) return result
  const { type, ...payload } = action
  await logReview(sb, { detectionId, projectId: det.project_id, photoId: det.photo_id, action: type, payload, before, after: type === "delete" ? null : await snapshot(sb, detectionId), userId: guard.userId, role: guard.role })

  let applied = 1
  const others = Array.from(new Set(alsoIds.filter((id) => id !== detectionId)))
  if (others.length && GROUP_ACTIONS.has(type)) {
    const { data: sibs } = await sb.from("project_photo_detections").select(cols).in("id", others).eq("project_id", det.project_id).is("review_status", null)
    // Goedkeuren of kiezen: bij de andere stippen hetzelfde merk, dezelfde
    // collectie of hetzelfde product — hun eigen kandidaatrij als die er is,
    // anders als zelf gekozen.
    let target: { level: MatchLevel; brand_id: string; collection_id: string | null; product_id: string | null } | null = null
    if (type === "approve" || type === "pick") {
      const { data: m } = await sb.from("project_photo_detection_matches").select("level, brand_id, collection_id, product_id").eq("detection_id", detectionId).eq("status", "approved").maybeSingle()
      if (m?.level) target = m
    }
    for (const sib of (sibs ?? []) as any[]) {
      let sibAction: ReviewAction = action
      if (target) {
        sibAction = await sameTargetAction(sb, sib.id, target)
      } else if (type === "approve" || type === "pick") {
        continue
      }
      const sibBefore = await snapshot(sb, sib.id)
      const r = await applyReview(sb, sib, sib.id, sibAction, guard.userId)
      if ("error" in r) continue
      applied++
      const { type: sibType, ...sibPayload } = sibAction
      await logReview(sb, { detectionId: sib.id, projectId: sib.project_id, photoId: sib.photo_id, action: sibType, payload: { ...sibPayload, via: detectionId }, before: sibBefore, after: await snapshot(sb, sib.id), userId: guard.userId, role: guard.role })
    }
  }
  // De laatste open stip beoordeeld door een admin: de live-mail die
  // daarop wachtte nu versturen (migratie 361; anders doet de cron het).
  let liveEmailSent = false
  if (guard.role === "admin") {
    try { liveEmailSent = (await releaseHeldLiveEmails(sb, det.project_id)).length > 0 } catch { /* de cron vangt het op */ }
  }
  return { ok: true, applied, liveEmailSent }
}

type MatchTarget = { level: MatchLevel; brand_id: string; collection_id: string | null; product_id: string | null }

/**
 * Goedkeuren van hetzelfde merk, dezelfde collectie of hetzelfde product bij
 * een andere stip: zijn eigen kandidaatrij als die er is, anders als zelf gekozen.
 */
async function sameTargetAction(sb: any, receiverId: string, target: MatchTarget): Promise<ReviewAction> {
  const { data: rows } = await sb.from("project_photo_detection_matches").select("id, brand_id, collection_id, product_id").eq("detection_id", receiverId)
  const list = (rows ?? []) as any[]
  const same = list.find((r) => target.level === "product" ? r.product_id === target.product_id
    : target.level === "collection" ? r.collection_id === target.collection_id
    : r.brand_id === target.brand_id && !r.collection_id)
    ?? (target.level === "brand" ? list.find((r) => r.brand_id === target.brand_id) : null)
  return same
    ? { type: "approve", matchId: same.id, level: target.level }
    : { type: "pick", target: { kind: target.level, id: (target.level === "product" ? target.product_id : target.level === "collection" ? target.collection_id : target.brand_id)! } }
}

/** Het oordeel van een stip als actie voor een andere stip; null als hij nog open staat. */
async function outcomeAction(sb: any, from: { id: string; review_status: string | null; missing_brand: string | null; missing_name: string | null }, receiverId: string): Promise<ReviewAction | null> {
  switch (from.review_status) {
    case "approved": {
      const { data: m } = await sb.from("project_photo_detection_matches").select("level, brand_id, collection_id, product_id").eq("detection_id", from.id).eq("status", "approved").maybeSingle()
      return m?.level ? sameTargetAction(sb, receiverId, m) : null
    }
    case "missing": return { type: "missing", brand: from.missing_brand ?? "", name: from.missing_name ?? "" }
    case "rejected": return { type: "reject" }
    case "hidden": return { type: "hide" }
    case "unknown": return { type: "unknown" }
    default: return null
  }
}

// ── Zelf koppelen: hetzelfde product op een andere foto ─────────────────

/**
 * "Zelfde als…": deze stip is hetzelfde product als `targetId` (een stip op
 * een andere foto van het project). Ze krijgen dezelfde sleutel (migratie
 * 345) en vormen voortaan één groep. Is de gekozen stip beoordeeld, dan
 * neemt deze stip (met de open stippen die er al aan vastzitten) dat oordeel
 * over; anders gaat het oordeel van deze stip naar de open stippen van de
 * gekozen kant. Twee open stippen: alleen de groep.
 */
export async function linkSameProduct(detectionId: string, targetId: string): Promise<{ ok: true; applied: number } | { error: string }> {
  if (detectionId === targetId) return { error: "Kies een andere stip." }
  const sb = createServiceRoleSupabaseClient() as any
  const cols = "id, project_id, photo_id, source, review_status, missing_brand, missing_name, same_product_key, box_x0, box_y0, box_y1, box_x1"
  const { data: pair } = await sb.from("project_photo_detections").select(cols).in("id", [detectionId, targetId])
  const d = ((pair ?? []) as any[]).find((x) => x.id === detectionId)
  const t = ((pair ?? []) as any[]).find((x) => x.id === targetId)
  if (!d || !t) return { error: "Product niet gevonden." }
  if (d.project_id !== t.project_id) return { error: "Alleen binnen hetzelfde project." }
  const guard = await requireProjectAccess(d.project_id)
  if ("error" in guard) return guard
  const table = () => sb.from("project_photo_detections")

  // De sleutel: die van de gekozen stip, anders die van deze, anders nieuw.
  // Twee verschillende sleutels: de groep van deze stip schuift erbij.
  const key: string = t.same_product_key ?? d.same_product_key ?? randomUUID()
  if (d.same_product_key && t.same_product_key && d.same_product_key !== t.same_product_key) {
    await table().update({ same_product_key: key }).eq("project_id", d.project_id).eq("same_product_key", d.same_product_key)
  }
  await table().update({ same_product_key: key }).in("id", [detectionId, targetId])
  await logReview(sb, { detectionId, projectId: d.project_id, photoId: d.photo_id, action: "link", payload: { targetId, key }, before: null, after: null, userId: guard.userId, role: guard.role })

  // Het oordeel overnemen: van de gekozen stip als die beoordeeld is (ook
  // over een eerder oordeel van deze stip heen), anders van deze stip naar
  // de open stippen aan de andere kant.
  const from = t.review_status ? t : d.review_status ? d : null
  if (!from) return { ok: true, applied: 0 }
  const { data: mates } = await table().select(cols).eq("project_id", d.project_id).eq("same_product_key", key).neq("id", from.id)
  const receivers = ((mates ?? []) as any[]).filter((x) => !x.review_status || (from === t && x.id === detectionId))
  let applied = 0
  for (const r of receivers) {
    const action = await outcomeAction(sb, from, r.id)
    if (!action) continue
    const before = await snapshot(sb, r.id)
    const res = await applyReview(sb, r, r.id, action, guard.userId)
    if ("error" in res) continue
    applied++
    const { type, ...payload } = action
    await logReview(sb, { detectionId: r.id, projectId: r.project_id, photoId: r.photo_id, action: type, payload: { ...payload, via: from.id, link: true }, before, after: await snapshot(sb, r.id), userId: guard.userId, role: guard.role })
  }
  return { ok: true, applied }
}

/** Een zelf gekoppelde stip weer los: het oordeel blijft staan. */
export async function unlinkSameProduct(detectionId: string): Promise<{ ok: true } | { error: string }> {
  const sb = createServiceRoleSupabaseClient() as any
  const { data: d } = await sb.from("project_photo_detections").select("id, project_id, photo_id, same_product_key").eq("id", detectionId).maybeSingle()
  if (!d) return { error: "Product niet gevonden." }
  const guard = await requireProjectAccess(d.project_id)
  if ("error" in guard) return guard
  if (!d.same_product_key) return { ok: true }
  await sb.from("project_photo_detections").update({ same_product_key: null }).eq("id", detectionId)
  // Blijft er één stip met de sleutel over, dan is er niets meer gekoppeld.
  const { data: rest } = await sb.from("project_photo_detections").select("id").eq("project_id", d.project_id).eq("same_product_key", d.same_product_key)
  if ((rest ?? []).length === 1) await sb.from("project_photo_detections").update({ same_product_key: null }).eq("id", rest[0].id)
  await logReview(sb, { detectionId, projectId: d.project_id, photoId: d.photo_id, action: "unlink", payload: { key: d.same_product_key }, before: null, after: null, userId: guard.userId, role: guard.role })
  return { ok: true }
}

async function applyReview(sb: any, det: any, detectionId: string, action: ReviewAction, userId: string): Promise<{ ok: true } | { error: string }> {
  const guard = { userId }
  const now = new Date().toISOString()
  const reviewed = { reviewed_by: guard.userId, reviewed_at: now }
  const matches = () => sb.from("project_photo_detection_matches")
  // Andere voorstellen opzij: wat goedgekeurd of voorgesteld was, wordt afgewezen.
  const rejectOthers = (exceptId?: string) => {
    let q = matches().update({ status: "rejected", ...reviewed }).eq("detection_id", detectionId).in("status", ["approved", "suggested"])
    if (exceptId) q = q.neq("id", exceptId)
    return q
  }
  const setDetection = (patch: Record<string, unknown>) => sb.from("project_photo_detections").update(patch).eq("id", detectionId)

  switch (action.type) {
    case "approve": {
      const { data: m } = await matches().select("id, level, product_id, collection_id").eq("id", action.matchId).eq("detection_id", detectionId).maybeSingle()
      if (!m) return { error: "Voorstel niet gevonden." }
      const level: MatchLevel = action.level ?? m.level ?? (m.product_id ? "product" : m.collection_id ? "collection" : "brand")
      if (!levelFits(m, level)) return { error: "Dat niveau past niet bij deze kandidaat." }
      await rejectOthers(m.id)
      await matches().delete().eq("detection_id", detectionId).eq("source", "manual").neq("id", m.id)
      await matches().update({ status: "approved", level, ...reviewed }).eq("id", m.id)
      await setDetection({ review_status: "approved", missing_brand: null, missing_name: null, missing_brand_id: null, hidden_reason: null, ...reviewed })
      return { ok: true }
    }
    case "pick": {
      const t = action.target
      let row: { brand_id: string; collection_id: string | null; product_id: string | null; image_url: string | null } | null = null
      if (t.kind === "product") {
        const { data: p } = await sb.from("products").select("id, brand_id, collection_id, image_url").eq("id", t.id).maybeSingle()
        if (p) row = { brand_id: p.brand_id, collection_id: p.collection_id, product_id: p.id, image_url: p.image_url }
      } else if (t.kind === "collection") {
        const { data: c } = await sb.from("product_collections").select("id, brand_id, hero_image_url").eq("id", t.id).maybeSingle()
        if (c) row = { brand_id: c.brand_id, collection_id: c.id, product_id: null, image_url: c.hero_image_url }
      } else {
        const { data: b } = await sb.from("brands").select("id, logo_url").eq("id", t.id).maybeSingle()
        if (b) row = { brand_id: b.id, collection_id: null, product_id: null, image_url: b.logo_url }
      }
      if (!row) return { error: "Niet gevonden in de catalogus." }
      await rejectOthers()
      await matches().delete().eq("detection_id", detectionId).eq("source", "manual")
      const { error } = await matches().insert({ detection_id: detectionId, rank: 0, ...row, status: "approved", level: t.kind, source: "manual", ...reviewed })
      if (error) return { error: error.message }
      await setDetection({ review_status: "approved", missing_brand: null, missing_name: null, missing_brand_id: null, hidden_reason: null, ...reviewed })
      return { ok: true }
    }
    case "reject": {
      await rejectOthers()
      await matches().delete().eq("detection_id", detectionId).eq("source", "manual")
      await setDetection({ review_status: "rejected", missing_brand: null, missing_name: null, missing_brand_id: null, hidden_reason: null, ...reviewed })
      return { ok: true }
    }
    case "missing": {
      const brand = action.brand.trim().slice(0, 120), name = action.name.trim().slice(0, 160)
      if (!brand && !name) return { error: "Vul een merk of naam in." }
      await rejectOthers()
      await matches().delete().eq("detection_id", detectionId).eq("source", "manual")
      // Het merk vastleggen als het al in de catalogus staat; anders als
      // voorgesteld merk aanmaken (status Suggested, migratie 347), zodat het
      // in /admin/brands staat en met een domein te inventariseren is.
      const brandOf = await brandIdsByName(sb)
      const missingBrandId = brandOf(brand) ?? (brand ? await createSuggestedBrand(sb, brand) : null)
      await setDetection({ review_status: "missing", missing_brand: brand || null, missing_name: name || null, missing_brand_id: missingBrandId, hidden_reason: null, ...reviewed })
      // Bevestigd: dit product van dit merk hoort in de catalogus. Merk in de
      // selectie → de collecties inventariseren (hooguit eens per 30 dagen).
      if (missingBrandId) await autoInventoryBrands(sb, [missingBrandId])
      return { ok: true }
    }
    case "hide": {
      await setDetection({ review_status: "hidden", hidden_reason: action.reason ?? null, ...reviewed })
      return { ok: true }
    }
    case "unknown": {
      // Wel een product, niet te zeggen welk: het voorstel klopt dan ook niet
      // (zoals "klopt niet" vroeger), zodat dat oordeel bewaard blijft.
      await rejectOthers()
      await matches().delete().eq("detection_id", detectionId).eq("source", "manual")
      await setDetection({ review_status: "unknown", missing_brand: null, missing_name: null, missing_brand_id: null, hidden_reason: null, ...reviewed })
      return { ok: true }
    }
    case "reset": {
      // Terug naar de uitkomst van Claude: het voorstel (met reden) weer
      // voorgesteld, de rest kandidaat, zelf gekozen matches weg.
      await matches().delete().eq("detection_id", detectionId).eq("source", "manual")
      await matches().update({ status: "candidate", reviewed_by: null, reviewed_at: null }).eq("detection_id", detectionId).is("reason", null)
      await matches().update({ status: "suggested", reviewed_by: null, reviewed_at: null }).eq("detection_id", detectionId).not("reason", "is", null)
      await setDetection({ review_status: null, missing_brand: null, missing_name: null, missing_brand_id: null, hidden_reason: null, reviewed_by: null, reviewed_at: null })
      // Automatisch verborgen en nooit gekoppeld: nu alsnog koppelen (cron).
      await sb.from("project_photo_detections").update({ match_status: null, match_batch_id: null, match_error: null }).eq("id", detectionId).like("match_error", "auto-hidden%")
      return { ok: true }
    }
    case "level": {
      const { data: m } = await matches().select("id, product_id, collection_id").eq("detection_id", detectionId).in("status", ["approved", "suggested"])
        .order("status", { ascending: true }).limit(1).maybeSingle()
      if (!m) return { error: "Geen voorstel om aan te passen." }
      if (!levelFits(m, action.level)) return { error: "Dat niveau past niet bij deze kandidaat." }
      await matches().update({ level: action.level }).eq("id", m.id)
      return { ok: true }
    }
    case "move": {
      // Alleen de stip verplaatsen (migratie 346); het kader is het product.
      await setDetection({ dot_x: clamp01(action.x), dot_y: clamp01(action.y) })
      return { ok: true }
    }
    case "box": {
      const x0 = clamp01(Math.min(action.x0, action.x1)), x1 = clamp01(Math.max(action.x0, action.x1))
      const y0 = clamp01(Math.min(action.y0, action.y1)), y1 = clamp01(Math.max(action.y0, action.y1))
      if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return { error: "Het kader is te klein." }
      // De stip naar het midden van het nieuwe kader (zonder eigen plek staat
      // hij daar vanzelf); daarna is hij weer te verslepen.
      const patch: Record<string, unknown> = {
        box_x0: x0, box_y0: y0, box_x1: x1, box_y1: y1,
        dot_x: null, dot_y: null,
      }
      // Nog niet beoordeeld en door Claude gevonden: opnieuw koppelen met de
      // nieuwe uitsnede (de cron pakt match_status null op). Wat al beoordeeld
      // is, houdt zijn koppeling; alleen het kader verandert.
      if (!det.review_status && det.source === "ai") {
        await matches().delete().eq("detection_id", detectionId).or("source.is.null,source.neq.manual")
        Object.assign(patch, { embedding: null, match_status: null, match_batch_id: null, match_error: null })
      }
      await setDetection(patch)
      return { ok: true }
    }
    case "delete": {
      if (det.source !== "manual") return { error: "Alleen een zelf toegevoegd product kan weg; verberg de andere." }
      await sb.from("project_photo_detections").delete().eq("id", detectionId)
      return { ok: true }
    }
  }
}

/** Zelf een product op de foto zetten: een getekend kader (0–1); daarna kiezen wat het is. */
export async function addDetection(photoId: string, box: { x0: number; y0: number; x1: number; y1: number }): Promise<{ id: string } | { error: string }> {
  const sb = createServiceRoleSupabaseClient() as any
  const { data: photo } = await sb.from("project_photos").select("id, project_id").eq("id", photoId).maybeSingle()
  if (!photo) return { error: "Foto niet gevonden." }
  const guard = await requireProjectAccess(photo.project_id)
  if ("error" in guard) return guard
  const x0 = clamp01(Math.min(box.x0, box.x1)), x1 = clamp01(Math.max(box.x0, box.x1))
  const y0 = clamp01(Math.min(box.y0, box.y1)), y1 = clamp01(Math.max(box.y0, box.y1))
  if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return { error: "Het kader is te klein." }
  const { data: last } = await sb.from("project_photo_detections").select("rank").eq("photo_id", photoId).order("rank", { ascending: false }).limit(1).maybeSingle()
  const { data, error } = await sb.from("project_photo_detections").insert({
    photo_id: photoId, project_id: photo.project_id, rank: (last?.rank ?? 0) + 1, label: "Zelf toegevoegd",
    box_x0: x0, box_y0: y0, box_x1: x1, box_y1: y1,
    // Geen koppelronde: een admin kiest zelf.
    source: "manual", match_status: "done",
  }).select("id").single()
  if (error) return { error: error.message }
  await logReview(sb, { detectionId: data.id, projectId: photo.project_id, photoId, action: "add", payload: { box: { x0, y0, x1, y1 } }, before: null, after: await snapshot(sb, data.id), userId: guard.userId, role: guard.role })
  return { id: data.id }
}

// ── Zoeken in de catalogus ──────────────────────────────────────────────

export type CatalogHit = { kind: MatchLevel; id: string; title: string; subtitle: string | null; imageUrl: string | null }

/**
 * Merken, collecties en producten op naam. Staat er een merknaam in de
 * zoekterm ("edra on the rocks"), dan zoeken we binnen dat merk op de rest.
 */
export async function searchCatalog(query: string): Promise<{ hits: CatalogHit[] } | { error: string }> {
  const guard = await requireReviewer()
  if ("error" in guard) return guard
  const q = query.toLowerCase().replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim()
  if (q.length < 2) return { hits: [] }
  const sb = createServiceRoleSupabaseClient() as any
  // Alle merken (in blokken van 1000; PostgREST geeft er niet meer per keer).
  const all = await allBrands(sb)
  const inQuery = all.filter((b) => b.name.length >= 2 && q.includes(b.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0] ?? null
  const rest = inQuery ? q.replace(inQuery.name.toLowerCase(), " ").replace(/\s+/g, " ").trim() : q
  const brandName = new Map(all.map((b) => [b.id, b.name]))

  let colQ = sb.from("product_collections").select("id, name, brand_id, hero_image_url").order("name").limit(12)
  let prodQ = sb.from("products").select("id, name, brand_id, image_url, product_collections(name)").order("name").limit(12)
  if (inQuery) { colQ = colQ.eq("brand_id", inQuery.id); prodQ = prodQ.eq("brand_id", inQuery.id) }
  if (rest) { colQ = colQ.ilike("name", `%${rest}%`); prodQ = prodQ.ilike("name", `%${rest}%`) }
  const [{ data: cols }, { data: prods }] = await Promise.all([colQ, rest || !inQuery ? prodQ : Promise.resolve({ data: [] })])

  const brandHits: CatalogHit[] = (inQuery && !rest ? [inQuery] : all.filter((b) => b.name.toLowerCase().includes(q)).slice(0, 5))
    .map((b) => ({ kind: "brand", id: b.id, title: b.name, subtitle: "Merk", imageUrl: b.logo_url }))
  const colHits: CatalogHit[] = ((cols ?? []) as any[]).map((c) => ({ kind: "collection", id: c.id, title: c.name, subtitle: `${brandName.get(c.brand_id) ?? ""} · collectie`, imageUrl: c.hero_image_url }))
  const prodHits: CatalogHit[] = ((prods ?? []) as any[]).map((p) => ({
    kind: "product", id: p.id, title: p.name,
    subtitle: [brandName.get(p.brand_id), p.product_collections?.name, "product"].filter(Boolean).join(" · "),
    imageUrl: p.image_url,
  }))
  return { hits: [...brandHits, ...colHits, ...prodHits] }
}

// ── Merk inventariseren vanuit een herkend product ──────────────────────

/**
 * Een herkend merk in de catalogus brengen: staat het er al, dan de
 * collecties (opnieuw) inventariseren; anders eerst het merk toevoegen vanaf
 * zijn site. De stip wacht daarna op de catalogus (requeueAwaitingCatalog).
 */
export async function inventoryRecognizedBrand(brandName: string, website: string | null): Promise<{ brandId: string; brandName: string; logoUrl: string | null; created: boolean; started: boolean } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const sb = createServiceRoleSupabaseClient() as any
  let brandId: string | null = (await brandIdsByName(sb))(brandName)
  let created = false
  if (!brandId) {
    if (!website) return { error: "Vul de website van het merk in." }
    const url = /^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${website.trim()}`
    const added = await addBrandFromSite(url)
    if ("error" in added) return { error: added.error }
    brandId = added.brandId
    created = added.created
  }
  // Inventariseren vanuit een herkend product zet het merk in de selectie.
  await sb.from("brands").update({ is_curated: true }).eq("id", brandId).eq("is_curated", false)
  const started = await startCollectionInventory([brandId])
  if ("error" in started) return { error: started.error }
  const { data: b } = await sb.from("brands").select("name, logo_url").eq("id", brandId).maybeSingle()
  return { brandId: brandId as string, brandName: b?.name ?? brandName, logoUrl: b?.logo_url ?? null, created, started: started.started > 0 }
}

// ── Zelf koppelen: merk en collectie kiezen ─────────────────────────────

export type BrandHit = { id: string; name: string; logoUrl: string | null }
export type BrandCollection = { id: string; name: string; imageUrl: string | null; /** Van de soort van de stip (of eronder/erboven). */ fits: boolean }

/** Merken uit de selectie (ster) op naam, voor het koppelveld in de kaart. */
export async function searchCuratedBrands(query: string): Promise<{ brands: BrandHit[]; /** Bestaat wel, maar zonder ster. */ outsideSelection: BrandHit | null } | { error: string }> {
  const guard = await requireReviewer()
  if ("error" in guard) return guard
  const q = query.trim().toLowerCase()
  if (q.length < 1) return { brands: [], outsideSelection: null }
  const sb = createServiceRoleSupabaseClient() as any
  const all = await allBrands(sb)
  const { data: out } = await sb.from("brands").select("id").eq("is_curated", false)
  const excluded = new Set(((out ?? []) as Array<{ id: string }>).map((b) => b.id))
  const hits = all
    .filter((b) => !excluded.has(b.id) && b.name.toLowerCase().includes(q))
    // Begint met de zoekterm eerst, daarna korte namen.
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || a.name.length - b.name.length)
    .slice(0, 6)
  const outside = hits.length ? null : all.find((b) => excluded.has(b.id) && b.name.toLowerCase().includes(q)) ?? null
  return {
    brands: hits.map((b) => ({ id: b.id, name: b.name, logoUrl: b.logo_url })),
    outsideSelection: outside ? { id: outside.id, name: outside.name, logoUrl: outside.logo_url } : null,
  }
}

/**
 * De collecties van een merk, met de hero zoals de collectiepagina hem
 * toont. Collecties van de soort van de stip (de soort zelf, eronder of
 * erboven) staan bovenaan.
 */
export async function listBrandCollections(brandId: string, kindSlug: string | null): Promise<{ collections: BrandCollection[] } | { error: string }> {
  const guard = await requireReviewer()
  if ("error" in guard) return guard
  const sb = createServiceRoleSupabaseClient() as any
  const [{ data: cols }, { data: cats }] = await Promise.all([
    sb.from("product_collections").select("id, name, category_id, hero_image_url").eq("brand_id", brandId).order("name"),
    sb.from("product_categories").select("id, slug, parent_id"),
  ])
  const collections = (cols ?? []) as Array<{ id: string; name: string; category_id: string | null; hero_image_url: string | null }>
  if (collections.length === 0) return { collections: [] }
  const ids = collections.map((c) => c.id)
  const [{ data: kinds }, { data: photos }] = await Promise.all([
    sb.from("product_collection_kinds").select("collection_id, category_id").in("collection_id", ids),
    sb.from("product_collection_photos").select("collection_id, url, is_primary, order_index, kind").in("collection_id", ids).order("order_index"),
  ])
  // De soort van de stip met alles eronder en de tussenliggende soorten erboven.
  const rows = (cats ?? []) as Array<{ id: string; slug: string; parent_id: string | null }>
  const fitting = new Set<string>()
  const kind = kindSlug ? rows.find((r) => r.slug === kindSlug) : null
  if (kind) {
    const parent = new Map(rows.map((r) => [r.id, r.parent_id]))
    const stack = [kind.id]
    while (stack.length) { const id = stack.pop()!; fitting.add(id); for (const r of rows) if (r.parent_id === id && !fitting.has(r.id)) stack.push(r.id) }
    let p = parent.get(kind.id) ?? null
    while (p && parent.get(p)) { fitting.add(p); p = parent.get(p) ?? null }
  }
  const kindsOf = new Map<string, string[]>()
  for (const k of (kinds ?? []) as Array<{ collection_id: string; category_id: string }>) kindsOf.set(k.collection_id, [...(kindsOf.get(k.collection_id) ?? []), k.category_id])
  const grouped = new Map<string, Array<{ url: string; isPrimary: boolean; kind: string | null }>>()
  for (const p of (photos ?? []) as Array<{ collection_id: string; url: string; is_primary: boolean; kind: string | null }>) {
    grouped.set(p.collection_id, [...(grouped.get(p.collection_id) ?? []), { url: p.url, isPrimary: p.is_primary, kind: p.kind }])
  }
  const list: BrandCollection[] = collections.map((c) => ({
    id: c.id, name: c.name,
    imageUrl: pickCollectionHero(grouped.get(c.id) ?? [])?.url ?? c.hero_image_url ?? null,
    fits: fitting.size > 0 && [c.category_id, ...(kindsOf.get(c.id) ?? [])].some((id) => id && fitting.has(id)),
  }))
  return { collections: list.sort((a, b) => Number(b.fits) - Number(a.fits) || a.name.localeCompare(b.name)) }
}
