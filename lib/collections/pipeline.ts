import "server-only"

import Anthropic from "@anthropic-ai/sdk"
import { Firecrawl } from "@mendable/firecrawl-js"
import { revalidatePath as nextRevalidate } from "next/cache"

import { descriptionTranslations, mergeTranslations, type Translations } from "@/lib/collections/translate"
import { logger } from "@/lib/logger"
import { imageSize } from "@/lib/images/image-size"
import { syncBrandCategoriesFromCollections } from "@/lib/products/brand-categories"
import { categoryLevels, syncCollectionSubgroups, type CategoryLevels, type CategoryRow } from "@/lib/products/collection-subgroups"
import { fetchPage } from "@/lib/collections/fetch-page"
import { absoluteHttpUrl, pageMainImage, slugify, storeRemoteImage, stripWww, syncCollectionCover } from "@/lib/collections/shared"
import { regroupCandidates } from "@/lib/collections/families"
import {
  MAX_OVERVIEW_PAGES, MAX_AMBIANCE_PHOTOS, MAX_DETAIL_PHOTOS, MAX_PHOTO_CANDIDATES,
  pickPagesRequest, overviewRequest, collectionReadRequest, photoChoiceRequest,
  type BatchRequest, type CategoryLine, type CollectionRead, type OverviewCollection, type PhotoChoice,
} from "@/lib/collections/prompts"

/**
 * Collecties van een merk, op de achtergrond (migratie 325).
 *
 * Een taak in brand_collection_jobs gaat stap voor stap; de cron
 * (/api/cron/collection-pipeline) roept elke minuut tickCollectionJobs aan.
 * Elk Claude-werk gaat als batch (half geld, meestal binnen het uur); een
 * stap die op een batch wacht, kijkt de volgende ronde weer.
 *
 * Inventariseren (kind "inventory"):
 *   queued          site in kaart (Firecrawl map, 1 credit) → batch: welke pagina's
 *   picking_pages   wacht op die batch
 *   fetching_pages  overzichtspagina's ophalen (eerst gratis) → batch per ronde
 *   reading_pages   wacht; daarna de gevonden collecties als kandidaten
 *   storing_images  het beeld van elke kandidaat naar onze opslag
 *   done
 *
 * Ophalen (kind "enrich"), per gekozen collectie in state.items:
 *   fetch → reading (batch: omschrijving, ontwerper, jaar, soorten,
 *   producten, kandidaatfoto's) → photos (batch met beeld: sfeerbeelden
 *   kiezen) → done.
 */

const TIME_BUDGET_MS = 230_000
const MAX_MAP_URLS = 400
const MAX_PRODUCT_IMAGES = 24
/** Extra productbeelden (migratie 331) die per collectie worden opgeslagen;
 *  daarboven bewaren we de bron-URL, een script kan ze later kopiëren. */
const MAX_EXTRA_PRODUCT_IMAGES = 40

type Job = {
  id: string
  brand_id: string
  kind: "inventory" | "enrich"
  stage: string
  progress_done: number
  progress_total: number
  state: any
  firecrawl_credits: number
}
type Brand = { id: string; name: string; domain: string | null; website: string | null }
type Cats = { lines: CategoryLine[]; idBySlug: Map<string, string>; levels: CategoryLevels }

/** Pagina's verversen; buiten een Next-verzoek (script) is er niets te verversen. */
function revalidatePath(path: string) {
  try { nextRevalidate(path) } catch { /* buiten Next */ }
}

function anthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

async function save(sb: any, job: Job, patch: Partial<Job> & { error?: string | null; finished_at?: string | null }) {
  Object.assign(job, patch)
  await sb.from("brand_collection_jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", job.id)
}

/** Alleen actieve categorieën (en niets onder een geparkeerde, migratie 351). */
async function loadCategories(sb: any): Promise<Cats> {
  const { data } = await sb.from("product_categories").select("id, slug, name, parent_id, is_active, order_index")
  const all = (data ?? []) as Array<CategoryRow & { name: string }>
  const levels = categoryLevels(all)
  const rows = all.filter((r) => levels.isLive(r.id))
  const byId = new Map(rows.map((r) => [r.id, r]))
  const path = (r: { name: string; parent_id: string | null }) => {
    const parts: string[] = []
    let cur: { name: string; parent_id: string | null } | undefined = r
    for (let i = 0; cur && i < 6; i++) { parts.unshift(cur.name); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined }
    return parts.join(" › ")
  }
  return { lines: rows.map((r) => ({ slug: r.slug, path: path(r) })), idBySlug: new Map(rows.map((r) => [r.slug, r.id])), levels }
}

async function submitBatch(requests: BatchRequest[]): Promise<string | null> {
  if (requests.length === 0) return null
  const batch = await anthropic().messages.batches.create({ requests } as any)
  return batch.id
}

/** De uitkomsten van een batch, of null als hij nog loopt. */
async function readBatch(id: string): Promise<Map<string, any | null> | null> {
  const client = anthropic()
  const batch = await client.messages.batches.retrieve(id)
  if (batch.processing_status !== "ended") return null
  const out = new Map<string, any | null>()
  for await (const r of await client.messages.batches.results(id)) {
    if (r.result.type !== "succeeded") { out.set(r.custom_id, null); continue }
    const msg = r.result.message
    if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") { out.set(r.custom_id, null); continue }
    const text = msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("")
    try { out.set(r.custom_id, JSON.parse(text)) } catch { out.set(r.custom_id, null) }
  }
  return out
}

function brandOrigin(b: Brand): string | null {
  const raw = b.website || (b.domain ? `https://${b.domain}/` : null)
  if (!raw) return null
  try { const u = new URL(raw); return `${u.protocol}//${u.host}/` } catch { return null }
}

/** Beelden in een grotere maat of zonder opvulling:
 *  - Shopify: …_720x.jpg → …_1600x.jpg;
 *  - de beeldschaler van edra.com (ridimensiona.html/rem/B/H/vlag__/): vlag
 *    030 vult op tot B×H met zwarte balken, 100 snijdt bij; 000 geeft het
 *    beeld in zijn eigen verhouding, tot 1920. */
export function upsize(url: string): string {
  if (/\/cdn\/shop\/|cdn\.shopify\.com/.test(url)) return url.replace(/_(\d+x\d*|\d*x\d+)(?=\.(jpe?g|png|webp)(\?|$))/i, "_1600x")
  if (/\/ridimensiona\.html\/rem\/\d+\/\d+\/\d{3}__\//i.test(url)) return url.replace(/\/ridimensiona\.html\/rem\/\d+\/\d+\/\d{3}__\//i, "/ridimensiona.html/rem/1920/1920/000__/")
  return url
}

const cleanName = (s: string) => s.replace(/[™®©]/g, "").replace(/\s+/g, " ").trim()

// ── Site in kaart ──────────────────────────────────────────────────────

const SKIP_PATH = /(\/|^)(blog|news|press|journal|magazine|stories|events?|contact|careers?|jobs|vacatures|privacy|cookies?|terms|legal|imprint|impressum|disclaimer|login|account|cart|checkout|wishlist|search|faq|downloads?|sitemap|tag|author|feed|wp-|cdn-cgi|policies)(\/|$|-)/i
const SKIP_EXT = /\.(pdf|jpe?g|png|webp|gif|svg|zip|dwg|dxf|xml|mp4|json)(\?|$)/i

function siteUrls(links: Array<{ url: string; title?: string }>, origin: string): Array<{ url: string; title: string | null }> {
  const host = stripWww(new URL(origin).hostname)
  const seen = new Set<string>()
  const rows: Array<{ url: string; title: string | null; path: string }> = []
  for (const l of links) {
    let u: URL
    try { u = new URL(l.url) } catch { continue }
    if (stripWww(u.hostname) !== host || SKIP_EXT.test(u.pathname) || SKIP_PATH.test(u.pathname)) continue
    u.hash = ""; u.search = ""
    const key = u.toString().replace(/\/$/, "")
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ url: u.toString(), title: l.title?.trim() || null, path: u.pathname })
  }
  // Meertalige sites: als er een Engelse versie is, alleen die (en de
  // pagina's zonder taalprefix).
  const lang = (p: string) => p.match(/^\/([a-z]{2})(?:[-_][a-z]{2})?\//i)?.[1]?.toLowerCase() ?? null
  const hasEn = rows.some((r) => lang(r.path) === "en")
  const kept = hasEn ? rows.filter((r) => { const l = lang(r.path); return l === null || l === "en" }) : rows
  return kept
    .sort((a, b) => a.path.split("/").length - b.path.split("/").length || a.path.length - b.path.length)
    .slice(0, MAX_MAP_URLS)
    .map(({ url, title }) => ({ url, title }))
}

/** De links op een pagina, met de linktekst als titel. Gratis. Voor de
 *  homepage als de map van Firecrawl (bijna) niets oplevert (minotti.com),
 *  en voor de categoriepagina's onder een gekozen index (edra.com). Een
 *  <link rel="next"> (oneindig scrollen, henge07.com) komt mee als rel "next". */
type PageLink = { url: string; title?: string; rel?: "next" }
async function pageLinks(pageUrl: string): Promise<PageLink[]> {
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ArcoBot/1.0)", Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return []
    const html = await res.text()
    const base = res.url || pageUrl
    const out: PageLink[] = []
    for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      let url: string
      try { url = new URL(m[1], base).toString() } catch { continue }
      const title = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)
      out.push({ url, title: title || undefined })
    }
    for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
      if (!/\brel\s*=\s*["']next["']/i.test(m[0])) continue
      const href = m[0].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]
      if (!href) continue
      try { out.push({ url: new URL(href, base).toString(), rel: "next" }) } catch { /* ongeldig */ }
    }
    return out
  } catch {
    return []
  }
}

/** Een index toont vaak alleen de eerste categorie (edra.com/en/collection:
 *  alleen banken), terwijl de andere categorieën eronder hangen en niet in
 *  de sitemap staan. De pagina's direct onder een gekozen pagina komen erbij,
 *  maar alleen als het er een handvol is: tientallen zijn productpagina's. */
const PRODUCT_SEGMENT = /\/(products?|prodotti|produkte?|producten|item|p)\//i
const PAGINATION = /\/page\/(\d+)\/?$/i
const MAX_PAGINATION = 5

/** De gekozen pagina's, aangevuld met (1) de categoriepagina's eronder en
 *  (2) de volgende pagina's van een lijst die doorbladert (henge07.com:
 *  /products/tables/page/2/). Alleen HTML ophalen, gratis. */
async function expandPages(picked: string[], origin: string): Promise<string[]> {
  const cache = new Map<string, PageLink[]>()
  const linksOf = async (u: string) => {
    if (!cache.has(u)) cache.set(u, await pageLinks(u))
    return cache.get(u)!
  }

  // 1. Categoriepagina's direct onder een gekozen index. Alleen als het er
  //    een handvol is: tientallen zijn productpagina's.
  const subs: string[] = []
  for (const page of picked.slice(0, 3)) {
    let base: URL
    try { base = new URL(page) } catch { continue }
    const prefix = base.pathname.replace(/\/$/, "") + "/"
    if (prefix === "/" || prefix.split("/").length > 5) continue
    const depth = prefix.split("/").length
    const found = siteUrls(await linksOf(page), origin)
      .map((l) => l.url)
      .filter((u) => {
        const p = new URL(u).pathname
        return p.startsWith(prefix) && p.length > prefix.length && p.split("/").length <= depth + 2
          && !PRODUCT_SEGMENT.test(p.slice(prefix.length - 1)) && !PAGINATION.test(p)
      })
    if (found.length >= 2 && found.length <= 20) subs.push(...found)
  }

  // 2. Doorbladeren: /page/N/ of ?page=N op dezelfde lijst, tot pagina 5.
  const out: string[] = []
  for (const page of [...picked, ...subs]) {
    out.push(page)
    let base: URL
    try { base = new URL(page) } catch { continue }
    const path = base.pathname.replace(/\/$/, "")
    let last = 1
    let style: "path" | "query" | null = null
    for (const l of await linksOf(page)) {
      let u: URL
      try { u = new URL(l.url) } catch { continue }
      if (stripWww(u.hostname) !== stripWww(base.hostname)) continue
      const m = u.pathname.match(PAGINATION)
      if (m && u.pathname.slice(0, m.index).replace(/\/$/, "") === path) { last = Math.max(last, Number(m[1])); style = "path"; continue }
      const q = u.searchParams.get("page") ?? u.searchParams.get("p")
      if (q && /^\d+$/.test(q) && u.pathname.replace(/\/$/, "") === path) { last = Math.max(last, Number(q)); style = style ?? "query" }
    }
    const norm = (u: string) => u.replace(/\/$/, "")
    const visited = new Set([norm(page)])
    let cur = page
    let count = 1
    for (let n = 2; n <= Math.min(last, MAX_PAGINATION); n++) {
      let next: string
      if (style === "path") next = `${base.origin}${path}/page/${n}/`
      else { const u = new URL(page); u.searchParams.set("page", String(n)); next = u.toString() }
      out.push(next); visited.add(norm(next)); cur = next; count++
    }
    // Daarna (of zonder zichtbare paginalinks) de keten van <link rel="next">
    // volgen: een lijst toont vaak alleen een link naar de volgende pagina.
    while (count < MAX_PAGINATION) {
      const next = (await linksOf(cur)).find((l) => l.rel === "next")?.url
      if (!next || visited.has(norm(next))) break
      try { if (stripWww(new URL(next).hostname) !== stripWww(base.hostname)) break } catch { break }
      out.push(next); visited.add(norm(next)); cur = next; count++
    }
  }
  return out
}

// ── Inventariseren ─────────────────────────────────────────────────────

async function stepInventory(sb: any, job: Job, brand: Brand, deadline: number): Promise<void> {
  const st = job.state ?? {}
  const origin = brandOrigin(brand)

  for (let guard = 0; guard < 6 && Date.now() < deadline; guard++) {
    if (job.stage === "queued") {
      if (st.pageUrl) {
        st.pages = [st.pageUrl]
      } else {
        if (!origin) return save(sb, job, { stage: "error", error: "This brand has no website.", finished_at: new Date().toISOString() })
        const key = process.env.FIRECRAWL_API_KEY
        // De links op de homepage altijd vooraan, met hun linktekst als
        // titel: daar staat het menu met de categorieën ("Sofas", "Beds").
        // De map van Firecrawl vult aan, maar geeft vaak een willekeurige
        // greep productpagina's zonder titel (minotti.com), en de keuze
        // ziet dan niet welke pagina een categorie is. Dubbelingen houden
        // de eerste, dus de titel van de homepage.
        const homeLinks = await pageLinks(origin)
        let mapLinks: Array<{ url: string; title?: string }> = []
        if (key) {
          const map = await new Firecrawl({ apiKey: key }).map(origin, { limit: 3000, sitemap: "include", ignoreQueryParameters: true })
          job.firecrawl_credits += 1
          mapLinks = (map?.links ?? []) as Array<{ url: string; title?: string }>
        }
        const urls = siteUrls([...homeLinks.filter((l) => !l.rel), ...mapLinks], origin)
        if (urls.length > 3) {
          st.batch = await submitBatch([pickPagesRequest("pick", brand.name, origin, urls)])
          await save(sb, job, { stage: "picking_pages", state: st, firecrawl_credits: job.firecrawl_credits, progress_done: 0, progress_total: 0 })
          continue
        }
        st.pages = [origin]
      }
      st.fetched = 0; st.batches = []; st.pageByRequest = {}
      await save(sb, job, { stage: "fetching_pages", state: st, firecrawl_credits: job.firecrawl_credits, progress_done: 0, progress_total: st.pages.length })
      continue
    }

    if (job.stage === "picking_pages") {
      const res = await readBatch(st.batch)
      if (!res) return
      const picked = ((res.get("pick")?.pages ?? []) as string[])
        .map((u) => (origin ? absoluteHttpUrl(u, origin) : null))
        .filter((u): u is string => Boolean(u))
      const unique = Array.from(new Set(picked))
      // Categoriepagina's onder een gekozen index en volgende pagina's van
      // een lijst komen erbij; dubbelingen (ook met of zonder slash) eruit.
      const key = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").toLowerCase()
      const seen = new Set<string>()
      const expanded = origin && unique.length ? await expandPages(unique, origin) : unique
      st.pages = expanded.filter((u) => !seen.has(key(u)) && (seen.add(key(u)), true)).slice(0, MAX_OVERVIEW_PAGES)
      if (st.pages.length === 0 && origin) st.pages = [origin]
      st.fetched = 0; st.batches = []; st.pageByRequest = {}
      await save(sb, job, { stage: "fetching_pages", state: st, progress_done: 0, progress_total: st.pages.length })
      continue
    }

    if (job.stage === "fetching_pages") {
      const cats = await loadCategories(sb)
      const requests: BatchRequest[] = []
      while (st.fetched < st.pages.length && Date.now() < deadline - 30_000) {
        const i = st.fetched
        // state.render: elke pagina via Firecrawl (gerenderd), voor sites
        // die hun overzicht met JavaScript inladen.
        const page = await fetchPage(st.pages[i], { maxChars: 150_000, render: Boolean(st.render) })
        if (page?.via === "firecrawl") job.firecrawl_credits += 1
        if (page) {
          const id = `o${i}`
          st.pageByRequest[id] = page.url
          requests.push(overviewRequest(id, brand.name, page.url, page.text, page.images, cats.lines))
        }
        st.fetched = i + 1
      }
      const batchId = await submitBatch(requests)
      if (batchId) st.batches.push(batchId)
      const finished = st.fetched >= st.pages.length
      if (finished && st.batches.length === 0) {
        return save(sb, job, { stage: "error", error: "None of the brand's pages could be read.", state: st, firecrawl_credits: job.firecrawl_credits, finished_at: new Date().toISOString() })
      }
      await save(sb, job, { stage: finished ? "reading_pages" : "fetching_pages", state: st, firecrawl_credits: job.firecrawl_credits, progress_done: st.fetched })
      if (!finished) return
      continue
    }

    if (job.stage === "reading_pages") {
      const all: Array<{ col: OverviewCollection; pageUrl: string }> = []
      let brandDescription: string | null = null
      let brandDescriptionNl: string | null = null
      for (const id of st.batches as string[]) {
        const res = await readBatch(id)
        if (!res) return
        // Op volgorde van de pagina's: de eerste (meest complete) omschrijving wint.
        for (const [customId, data] of Array.from(res.entries()).sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)))) {
          const pageUrl = st.pageByRequest[customId] ?? origin
          if (!brandDescription && typeof data?.brand_description === "string" && data.brand_description.trim()) {
            brandDescription = data.brand_description.trim()
            brandDescriptionNl = typeof data?.brand_description_nl === "string" && data.brand_description_nl.trim() ? data.brand_description_nl.trim() : null
          }
          for (const col of ((data?.collections ?? []) as OverviewCollection[])) all.push({ col, pageUrl })
        }
      }
      // De omschrijving van het merk, in het Engels en Nederlands (migratie
      // 330). Alleen als er nog geen staat (een handmatige tekst wint), of
      // als de taak om nieuwe teksten vraagt (refreshText).
      if (brandDescription) {
        const patch = { description: brandDescription.slice(0, 1200), translations: descriptionTranslations(brandDescription.slice(0, 1200), brandDescriptionNl?.slice(0, 1400) ?? null) }
        let q = sb.from("brands").update(patch).eq("id", brand.id)
        if (!st.refreshText) q = q.or("description.is.null,description.eq.")
        await q
      }
      const added = await insertCandidates(sb, brand.id, all)
      // Sites met losse producten en varianten (Flos: "2097/18", "2097/30"):
      // groeperen tot families, één kandidaat per familie (migratie 339).
      await regroupCandidates(sb, brand.id, brand.name)
      const { count } = await sb.from("brand_collection_candidates").select("id", { count: "exact", head: true })
        .eq("brand_id", brand.id).is("image_url", null).not("source_image_url", "is", null)
      st.found = added; st.failedImages = []
      await save(sb, job, { stage: "storing_images", state: st, progress_done: 0, progress_total: count ?? 0 })
      continue
    }

    if (job.stage === "storing_images") {
      const failed = new Set<string>(st.failedImages ?? [])
      const { data } = await sb.from("brand_collection_candidates").select("id, source_image_url")
        .eq("brand_id", brand.id).is("image_url", null).not("source_image_url", "is", null).limit(200)
      const todo = ((data ?? []) as Array<{ id: string; source_image_url: string }>).filter((c) => !failed.has(c.id))
      let done = job.progress_done
      for (let i = 0; i < todo.length && Date.now() < deadline - 20_000; i += 6) {
        await Promise.all(todo.slice(i, i + 6).map(async (c) => {
          const stored = await storeRemoteImage(sb, c.source_image_url, `brand-candidates/${brand.id}`)
          if (stored) { await sb.from("brand_collection_candidates").update({ image_url: stored }).eq("id", c.id); done++ }
          else failed.add(c.id)
        }))
      }
      st.failedImages = Array.from(failed)
      // Wat nog zonder beeld is, minus wat niet te halen was.
      const { count: left } = await sb.from("brand_collection_candidates").select("id", { count: "exact", head: true })
        .eq("brand_id", brand.id).is("image_url", null).not("source_image_url", "is", null)
      const remaining = (left ?? 0) - failed.size
      if (remaining > 0) return save(sb, job, { state: st, progress_done: done })
      await save(sb, job, { stage: "done", state: st, progress_done: job.progress_total, finished_at: new Date().toISOString() })
      revalidatePath("/admin/brands")
      return
    }
    return
  }
}

/** Gevonden collecties als kandidaten; bestaande collecties gelden als al gekozen. */
async function insertCandidates(sb: any, brandId: string, found: Array<{ col: OverviewCollection; pageUrl: string }>): Promise<number> {
  const cats = await loadCategories(sb)
  const [{ data: cols }, { data: cands }] = await Promise.all([
    sb.from("product_collections").select("id, slug").eq("brand_id", brandId),
    sb.from("brand_collection_candidates").select("id, slug, url, source_image_url, category_id, description").eq("brand_id", brandId),
  ])
  const collectionBySlug = new Map(((cols ?? []) as Array<{ id: string; slug: string }>).map((c) => [c.slug, c.id]))
  const candBySlug = new Map(((cands ?? []) as Array<any>).map((c) => [c.slug, c]))
  const seen = new Set<string>()
  const rows: any[] = []
  for (const { col, pageUrl } of found) {
    const name = cleanName(col.name ?? "")
    const slug = slugify(name)
    if (!name || seen.has(slug)) continue
    seen.add(slug)
    const url = absoluteHttpUrl(col.url, pageUrl)
    const img = absoluteHttpUrl(col.image_url, pageUrl)
    // Een collectie hangt aan een subgroep (niveau 2), ook als Claude een soort noemt.
    const categoryId = col.category_slug ? cats.levels.subgroupOf(cats.idBySlug.get(col.category_slug)) : null
    const existing = candBySlug.get(slug)
    if (existing) {
      // Alleen aanvullen wat nog leeg is.
      const patch: Record<string, unknown> = {}
      if (!existing.url && url) patch.url = url
      if (!existing.source_image_url && img) patch.source_image_url = upsize(img)
      if (!existing.category_id && categoryId) patch.category_id = categoryId
      if (!existing.description && col.description) patch.description = col.description
      if (Object.keys(patch).length) await sb.from("brand_collection_candidates").update(patch).eq("id", existing.id)
      continue
    }
    const collectionId = collectionBySlug.get(slug) ?? null
    rows.push({
      brand_id: brandId, name, slug, url, source_page_url: pageUrl, description: col.description?.trim() || null,
      category_id: categoryId, source_image_url: img ? upsize(img) : null,
      status: collectionId ? "chosen" : "found", collection_id: collectionId,
    })
  }
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from("brand_collection_candidates").insert(rows.slice(i, i + 200))
    if (error) logger.error("Candidate insert failed", { brandId }, error as any)
  }
  return rows.length
}

// ── Gekozen collecties ophalen ─────────────────────────────────────────

type Item = { step: "fetch" | "reading" | "photos" | "done"; failed?: boolean; photos?: string[] }

async function stepEnrich(sb: any, job: Job, brand: Brand, deadline: number): Promise<void> {
  const st = job.state ?? {}
  st.items = st.items ?? {}
  st.batches = st.batches ?? []
  const items: Record<string, Item> = st.items
  const cats = await loadCategories(sb)
  const readRequests: BatchRequest[] = []
  const photoRequests: BatchRequest[] = []

  // 1. Klaar staande batches verwerken.
  const stillOpen: Array<{ id: string; kind: "read" | "photos" }> = []
  for (const b of st.batches as Array<{ id: string; kind: "read" | "photos" }>) {
    if (Date.now() > deadline - 40_000) { stillOpen.push(b); continue }
    const res = await readBatch(b.id)
    if (!res) { stillOpen.push(b); continue }
    let unfinished = false
    for (const [customId, data] of res) {
      const colId = customId.slice(2)
      const item = items[colId]
      if (!item) continue
      if (Date.now() > deadline - 30_000) { unfinished = true; break }
      if (b.kind === "read" && item.step === "reading") {
        if (!data) { item.step = "done"; item.failed = true; continue }
        const photos = await applyRead(sb, colId, brand.id, data as CollectionRead, cats, Boolean(st.refreshText))
        // Alleen teksten vernieuwen: geen foto's opnieuw kiezen.
        if (st.textOnly) { item.step = "done"; continue }
        const { data: cover } = await sb.from("product_collection_photos").select("source_url").eq("collection_id", colId).eq("is_primary", true).maybeSingle()
        const list = Array.from(new Set([cover?.source_url, ...photos].filter((u): u is string => Boolean(u)))).slice(0, MAX_PHOTO_CANDIDATES)
        if (list.length === 0) { item.step = "done"; continue }
        const { data: col } = await sb.from("product_collections").select("name").eq("id", colId).maybeSingle()
        photoRequests.push(photoChoiceRequest(`p_${colId}`, col?.name ?? "", brand.name, list))
        item.photos = list
        item.step = "photos"
      } else if (b.kind === "photos" && item.step === "photos") {
        await applyPhotos(sb, colId, item.photos ?? [], (data as PhotoChoice | null) ?? null)
        item.step = "done"
        if (!data) item.failed = true
      }
    }
    if (unfinished) stillOpen.push(b)
  }
  st.batches = stillOpen

  // 2. Nieuwe collectiepagina's ophalen.
  for (const [colId, item] of Object.entries(items)) {
    if (item.step !== "fetch") continue
    if (Date.now() > deadline - 30_000) break
    const { data: col } = await sb.from("product_collections").select("id, name, url").eq("id", colId).maybeSingle()
    if (!col?.url) { item.step = "done"; continue }
    const page = await fetchPage(col.url, { maxChars: 50_000, mainContentOnly: true })
    if (page?.via === "firecrawl") job.firecrawl_credits += 1
    if (!page) { item.step = "done"; item.failed = true; continue }
    readRequests.push(collectionReadRequest(`r_${colId}`, col.name, brand.name, page.url, page.text, page.images, cats.lines))
    item.step = "reading"
  }

  // 3. Indienen.
  const readId = await submitBatch(readRequests)
  if (readId) st.batches.push({ id: readId, kind: "read" })
  const photoId = await submitBatch(photoRequests)
  if (photoId) st.batches.push({ id: photoId, kind: "photos" })

  const all = Object.values(items)
  const done = all.filter((i) => i.step === "done").length
  const finished = done === all.length
  await save(sb, job, {
    stage: finished ? "done" : "working",
    state: st,
    progress_done: done,
    progress_total: all.length,
    firecrawl_credits: job.firecrawl_credits,
    ...(finished ? { finished_at: new Date().toISOString() } : {}),
  })
  if (finished) {
    revalidatePath("/admin/brands")
    revalidatePath("/products")
  }
}

/** Velden, soorten en producten uit de collectiepagina; geeft de kandidaatfoto's terug. */
async function applyRead(sb: any, colId: string, brandId: string, data: CollectionRead, cats: Cats, refreshText = false): Promise<string[]> {
  const { data: col } = await sb.from("product_collections").select("url, description, designer, launch_year, category_id, materials, finishes, translations").eq("id", colId).maybeSingle()
  if (!col) return []
  const base = col.url ?? undefined
  const patch: Record<string, unknown> = { enriched_at: new Date().toISOString() }
  // Samengevoegd per taal: beschrijving en materialen overschrijven elkaar niet.
  let translations: Translations = col.translations ?? {}
  // De beschrijving (EN + NL, migratie 330): als er nog geen staat, als het
  // nog de korte zin uit de inventarisatie is, of als de taak om nieuwe
  // teksten vraagt. Een met de hand geschreven tekst blijft staan.
  if (data.description?.trim()) {
    const { data: cand } = await sb.from("brand_collection_candidates").select("description").eq("collection_id", colId).maybeSingle()
    const current = col.description?.trim() ?? ""
    if (!current || refreshText || current === (cand?.description?.trim() ?? "")) {
      patch.description = data.description.trim()
      const t = descriptionTranslations(data.description.trim(), data.description_nl?.trim() || null)
      translations = mergeTranslations(translations, t as Translations)
    }
  }
  // Materialen en afwerkingen (migratie 331): alleen als er nog geen staan,
  // een handmatige lijst wint. Nederlands in translations.nl.
  const clean = (xs: string[] | undefined, max: number) => Array.from(new Set((xs ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean))).slice(0, max)
  const materials = clean(data.materials, 6)
  if (materials.length > 0 && !(col.materials?.length > 0)) {
    patch.materials = materials
    translations = mergeTranslations(translations, { nl: { materials: clean(data.materials_nl, 6) } })
  }
  const finishes = clean(data.finishes, 10)
  if (finishes.length > 0 && !(col.finishes?.length > 0)) {
    patch.finishes = finishes
    translations = mergeTranslations(translations, { nl: { finishes: clean(data.finishes_nl, 10) } })
  }
  if (translations !== col.translations) patch.translations = translations
  if (!col.designer && data.designer) patch.designer = data.designer.trim()
  const thisYear = new Date().getFullYear()
  if (!col.launch_year && data.launch_year && data.launch_year >= 1800 && data.launch_year <= thisYear + 1) patch.launch_year = data.launch_year
  if (!col.category_id && data.category_slug) { const id = cats.levels.subgroupOf(cats.idBySlug.get(data.category_slug)); if (id) patch.category_id = id }
  await sb.from("product_collections").update(patch).eq("id", colId)

  // Subgroepen alleen als er nog geen staan; na de producten zet
  // syncCollectionSubgroups ze recht (handmatig gekozen subgroepen winnen).
  const kindIds = Array.from(new Set((data.kind_slugs ?? []).map((s) => cats.levels.subgroupOf(cats.idBySlug.get(s))).filter((x): x is string => Boolean(x)))).slice(0, 8)
  if (kindIds.length > 0) {
    const { count } = await sb.from("product_collection_kinds").select("collection_id", { count: "exact", head: true }).eq("collection_id", colId)
    if (!count) await sb.from("product_collection_kinds").insert(kindIds.map((category_id, position) => ({ collection_id: colId, category_id, position })))
  }

  // Producten: alleen nieuwe, herkend op naam en op productpagina.
  const { data: known } = await sb.from("products").select("slug, url").eq("collection_id", colId)
  const slugs = new Set(((known ?? []) as Array<{ slug: string }>).map((p) => p.slug))
  const urls = new Set(((known ?? []) as Array<{ url: string | null }>).map((p) => p.url).filter(Boolean))
  let images = 0
  let extraImages = 0
  for (const [i, p] of (data.products ?? []).slice(0, 40).entries()) {
    const name = cleanName(p.name ?? "")
    if (!name) continue
    const slug = slugify(name)
    let url = absoluteHttpUrl(p.url, base as any)
    if (url) { try { const u = new URL(url); u.search = ""; u.hash = ""; url = u.toString() } catch { url = null } }
    if (slugs.has(slug) || (url && urls.has(url))) continue
    slugs.add(slug)
    // Geen beeld op de collectiepagina maar wel een eigen pagina: het
    // hoofdbeeld van die pagina.
    const img = absoluteHttpUrl(p.image_url, base as any) ?? (url ? await pageMainImage(url) : null)
    const stored = img && images < MAX_PRODUCT_IMAGES ? await storeRemoteImage(sb, upsize(img), `product-families/${colId}/products`, slug) : null
    if (stored) images++
    const { data: inserted, error } = await sb.from("products").insert({
      brand_id: brandId, collection_id: colId, slug, name, url,
      // Een product hangt aan het diepste niveau: alleen een eindcategorie.
      category_id: p.kind_slug && cats.levels.isLeaf(cats.idBySlug.get(p.kind_slug)) ? cats.idBySlug.get(p.kind_slug)! : null,
      image_url: stored ?? img, source_image_url: img, position: i,
      variants: p.variants?.trim().slice(0, 200) || null,
    }).select("id").single()
    if (error) { logger.warn("Product insert failed", { colId, product: name, error: error.message }); continue }

    // Extra beelden van hetzelfde product (migratie 331): andere hoek of
    // uitvoering, om later projectfoto's tegen te vergelijken.
    const extras = Array.from(new Set((p.extra_image_urls ?? [])
      .map((u) => absoluteHttpUrl(u, base as any))
      .filter((u): u is string => Boolean(u))
      .map(upsize)))
      .filter((u) => u !== (img ? upsize(img) : null))
      .slice(0, 2)
    for (const [j, src] of extras.entries()) {
      const copy = extraImages < MAX_EXTRA_PRODUCT_IMAGES ? await storeRemoteImage(sb, src, `product-families/${colId}/products`, `${slug}-${j + 2}`) : null
      if (copy) extraImages++
      await sb.from("product_photos").insert({ product_id: inserted.id, url: copy ?? src, source_url: src, position: j + 1 })
    }
  }

  await syncCollectionSubgroups(sb, colId, cats.levels)
  await syncBrandCategoriesFromCollections(sb, brandId)

  return Array.from(new Set((data.photos ?? []).map((u) => absoluteHttpUrl(u, base as any)).filter((u): u is string => Boolean(u)).map(upsize)))
}

/** Sfeerbeelden (hooguit tien) en één productfoto opslaan; het eerste sfeerbeeld wordt de omslag. */
async function applyPhotos(sb: any, colId: string, list: string[], choice: PhotoChoice | null): Promise<void> {
  const pick = (n: number | null | undefined) => (n && n >= 1 && n <= list.length ? list[n - 1] : null)
  // Zonder antwoord (bv. een beeld dat Claude niet kon openen): de eerste
  // vier in paginavolgorde, zonder soort; de pagina zet sfeer al vooraan.
  const ambiance = choice
    ? Array.from(new Set(choice.ambiance.map(pick).filter((u): u is string => Boolean(u)))).slice(0, MAX_AMBIANCE_PHOTOS)
    : list.slice(0, 4)
  const product = choice ? pick(choice.product_shot) : null
  const detail = choice
    ? Array.from(new Set((choice.detail ?? []).map(pick).filter((u): u is string => Boolean(u) && !ambiance.includes(u as string) && u !== product))).slice(0, MAX_DETAIL_PHOTOS)
    : []

  const { data: existing } = await sb.from("product_collection_photos").select("id, source_url, url, order_index").eq("collection_id", colId)
  const rows = (existing ?? []) as Array<{ id: string; source_url: string | null; url: string; order_index: number }>
  const bySource = new Map(rows.map((r) => [r.source_url ?? r.url, r]))
  let order = rows.reduce((m, r) => Math.max(m, r.order_index), -1) + 1
  const kind = choice ? "ambiance" : null

  const added: Array<{ id: string; url: string }> = []
  const store = async (src: string, k: string | null) => {
    const have = bySource.get(src)
    if (have) { if (k) await sb.from("product_collection_photos").update({ kind: k }).eq("id", have.id); return have.id }
    const stored = await storeRemoteImage(sb, src, `product-families/${colId}`)
    if (!stored) return null
    const { data: row } = await sb.from("product_collection_photos")
      .insert({ collection_id: colId, url: stored, source_url: src, kind: k, is_primary: false, order_index: order++ })
      .select("id, url").maybeSingle()
    if (row) added.push(row)
    return row?.id ?? null
  }

  const ambianceIds: string[] = []
  for (let i = 0; i < ambiance.length; i += 5) {
    const ids = await Promise.all(ambiance.slice(i, i + 5).map((u) => store(u, kind)))
    ambianceIds.push(...ids.filter((x): x is string => Boolean(x)))
  }
  if (product && !ambiance.includes(product)) await store(product, "product")
  for (let i = 0; i < detail.length; i += 5) await Promise.all(detail.slice(i, i + 5).map((u) => store(u, "detail")))

  // Omslag: het eerste sfeerbeeld, anders blijft het overzichtsbeeld. Is de
  // omslag al een sfeerbeeld (bv. met de hand gekozen), dan blijft die.
  const { data: currentCover } = await sb.from("product_collection_photos").select("kind").eq("collection_id", colId).eq("is_primary", true).maybeSingle()
  if (choice && ambianceIds.length > 0 && currentCover?.kind !== "ambiance") {
    await sb.from("product_collection_photos").update({ is_primary: false }).eq("collection_id", colId)
    await sb.from("product_collection_photos").update({ is_primary: true }).eq("id", ambianceIds[0])
  }

  // Maten, zodat de hero een liggende foto kan kiezen (migratie 322).
  await Promise.all(added.map(async (ph) => {
    try {
      const res = await fetch(ph.url)
      if (!res.ok) return
      const size = imageSize(new Uint8Array(await res.arrayBuffer()))
      if (size) await sb.from("product_collection_photos").update({ width: size.width, height: size.height }).eq("id", ph.id)
    } catch { /* geen maat, geen ramp */ }
  }))
  await syncCollectionCover(sb, colId)
}

// ── De ronde ───────────────────────────────────────────────────────────

/**
 * `holder`: een vaste eigenaar (het lokale script). Die mag taken pakken
 * die hij zelf vasthoudt en houdt ze na de ronde vast, zodat een cron met
 * oudere code ze tussen twee rondes niet oppakt.
 */
export async function tickCollectionJobs(sb: any, options?: { holder?: string }): Promise<Array<{ id: string; kind: string; stage: string; error?: string }>> {
  const deadline = Date.now() + TIME_BUDGET_MS
  const { data: jobs } = await sb.from("brand_collection_jobs")
    .select("id, brand_id, kind, stage, progress_done, progress_total, state, firecrawl_credits")
    .not("stage", "in", "(done,error)")
    .order("updated_at", { ascending: true })
    .limit(25)
  const report: Array<{ id: string; kind: string; stage: string; error?: string }> = []
  for (const job of (jobs ?? []) as Job[]) {
    if (Date.now() > deadline - 30_000) break
    // Claimen: een andere ronde die nog bezig is, laat deze taak met rust.
    const now = new Date().toISOString()
    const held = options?.holder ? (job.state?.holder === options.holder) : false
    let claimQ = sb.from("brand_collection_jobs")
      .update({ locked_until: new Date(Date.now() + 6 * 60_000).toISOString() })
      .eq("id", job.id)
    if (!held) claimQ = claimQ.or(`locked_until.is.null,locked_until.lt.${now}`)
    const { data: claimed } = await claimQ.select("id")
    if (!claimed?.length) continue
    try {
      const { data: brand } = await sb.from("brands").select("id, name, domain, website").eq("id", job.brand_id).maybeSingle()
      if (!brand) { await save(sb, job, { stage: "error", error: "Brand not found.", finished_at: now }); continue }
      if (job.kind === "inventory") await stepInventory(sb, job, brand, deadline)
      else await stepEnrich(sb, job, brand, deadline)
      report.push({ id: job.id, kind: job.kind, stage: job.stage })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error("Collection job step failed", { jobId: job.id, stage: job.stage }, err as Error)
      // Tijdelijke fouten (netwerk, limiet) nog een paar keer proberen.
      const attempts = (job.state?.attempts ?? 0) + 1
      if (attempts >= 5) await save(sb, job, { stage: "error", error: message.slice(0, 500), finished_at: new Date().toISOString() })
      else await save(sb, job, { state: { ...job.state, attempts } })
      report.push({ id: job.id, kind: job.kind, stage: job.stage, error: message })
    } finally {
      if (options?.holder) {
        // Vasthouden tot de volgende lokale ronde (die over 30 s komt).
        await sb.from("brand_collection_jobs")
          .update({ locked_until: new Date(Date.now() + 5 * 60_000).toISOString(), state: { ...job.state, holder: options.holder } })
          .eq("id", job.id)
      } else {
        await sb.from("brand_collection_jobs").update({ locked_until: null }).eq("id", job.id)
      }
    }
  }
  return report
}
