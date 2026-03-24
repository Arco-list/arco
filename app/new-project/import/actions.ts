"use server"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { JSDOM } from "jsdom"
import { logger } from "@/lib/logger"
import Anthropic from "@anthropic-ai/sdk"
import { Firecrawl } from "@mendable/firecrawl-js"
import { SPACE_SLUGS, type SpaceSlug } from "@/lib/spaces"

export type ScrapeResult =
  | { projectId: string; title: string }
  | { error: string }

interface ExtractedProject {
  title: string
  description: string | null
  building_year: number | null
  scope: string | null
  location: string | null
  building_type: string | null
  style: string | null
  is_relevant_project: boolean
}

/** Strip common suffixes from page titles: location, company name, separators */
function cleanPageTitle(raw: string): string {
  // Split on common separators and take the first segment (the project name)
  const separators = [' - ', ' | ', ' — ', ' – ', ' :: ', ' // ']
  let title = raw
  for (const sep of separators) {
    if (title.includes(sep)) {
      title = title.split(sep)[0]
      break
    }
  }
  return title.trim().slice(0, 120) || "Untitled Project"
}

// ─── Firecrawl helpers ────────────────────────────────────────────────────────

/** Extract image URLs from Firecrawl markdown (![alt](url) patterns) */
/** Try to upgrade an image URL to its full-resolution variant */
function upgradeToFullRes(url: string): string {
  let upgraded = url
  // WordPress: remove -WxH suffix before extension (e.g. image-1024x768.jpg → image.jpg)
  upgraded = upgraded.replace(/-\d+x\d+(\.\w+)(?:\?|$)/, "$1")
  // Query-based resizing: remove w, width, h, height, resize, fit params
  try {
    const parsed = new URL(upgraded)
    for (const param of ["w", "h", "width", "height", "resize", "fit", "quality", "q", "size"]) {
      parsed.searchParams.delete(param)
    }
    upgraded = parsed.toString()
  } catch { /* keep original */ }
  return upgraded
}

function extractImagesFromMarkdown(markdown: string, baseUrl: string, ogImage?: string): string[] {
  const seen = new Set<string>()
  const results: string[] = []

  const add = (src: string) => {
    try {
      const abs = new URL(src, baseUrl).toString()
      // Try full-res variant
      const fullRes = upgradeToFullRes(abs)
      const key = fullRes || abs
      if (seen.has(key)) return
      if (/\.(svg|ico|gif)(\?|$)/i.test(key)) return
      if (/logo|icon|avatar|favicon|sprite|placeholder/i.test(key)) return
      seen.add(key)
      results.push(key)
    } catch { /* ignore invalid URLs */ }
  }

  // og:image first (from Firecrawl metadata)
  if (ogImage) add(ogImage)

  // Extract all markdown image URLs: ![...](url)
  const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g
  let match
  while ((match = imgRegex.exec(markdown)) !== null) {
    add(match[1])
  }

  return results.slice(0, 12)
}

// ─── JSDOM fallback helpers ───────────────────────────────────────────────────

/** Strip scripts/styles/nav/footer from HTML and return readable plain text */
function extractReadableText(doc: Document): string {
  const clone = doc.documentElement.cloneNode(true) as HTMLElement

  for (const selector of ["script", "style", "nav", "footer", "header", "aside", "noscript", "iframe", "svg"]) {
    clone.querySelectorAll(selector).forEach((el) => el.remove())
  }

  const mainEl =
    clone.querySelector("main") ||
    clone.querySelector('[role="main"]') ||
    clone.querySelector("article") ||
    clone.querySelector(".content") ||
    clone.querySelector("#content") ||
    clone.body

  const text = (mainEl?.textContent ?? clone.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000)

  return text
}

/** Extract image URLs from JSDOM document */
function extractImagesFromDom(doc: Document, baseUrl: string): string[] {
  const seen = new Set<string>()
  const results: string[] = []

  const add = (src: string) => {
    try {
      const abs = new URL(src, baseUrl).toString()
      if (seen.has(abs)) return
      if (/\.(svg|ico|gif)(\?|$)/i.test(abs)) return
      if (/logo|icon|avatar|favicon|sprite|placeholder/i.test(abs)) return
      seen.add(abs)
      results.push(abs)
    } catch { /* ignore invalid URLs */ }
  }

  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute("content")
  if (ogImage) add(ogImage)

  const clone = doc.documentElement.cloneNode(true) as HTMLElement
  for (const sel of ["script", "style", "nav", "footer", "header", "aside", "noscript"]) {
    clone.querySelectorAll(sel).forEach((el) => el.remove())
  }
  const mainEl =
    clone.querySelector("main") ||
    clone.querySelector('[role="main"]') ||
    clone.querySelector("article") ||
    clone.body

  mainEl?.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy-src")
    if (!src) return
    const w = parseInt(img.getAttribute("width") ?? "0", 10)
    const h = parseInt(img.getAttribute("height") ?? "0", 10)
    if ((w && w < 200) || (h && h < 200)) return
    add(src)
  })

  return results.slice(0, 12)
}

// ─── Claude extraction ───────────────────────────────────────────────────────

/** Use Claude to intelligently extract structured project data */
async function extractWithClaude(pageText: string, pageUrl: string): Promise<ExtractedProject> {
  const client = new Anthropic()

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    system: `You are an expert at extracting structured data from architecture and interior design project pages.
Given the text content of a web page, extract the following fields as JSON.
Only return a valid JSON object — no prose, no markdown, no code fences.

Fields:
- is_relevant_project (boolean): true ONLY if this page is about a specific architecture, interior design, construction, or real estate project (e.g. a villa renovation, a new build, an interior redesign). Return false for: company about pages, blog posts, contact pages, service descriptions, team pages, portfolios/galleries without a single project focus, product pages, or any page that is not a dedicated project showcase.
- title (string, max 120 chars): The project name ONLY — strip the location, city, company/studio name, and any separators (e.g. " - ", " | ") from the page title. For example, "Moderne villa met horizontale belijning - Diepenveen - Atelier 3" should become "Modern villa with horizontal lines". If no clear project name exists, derive one from the content. ALWAYS translate to English.
- description (string | null, max 300 chars): Exactly 2 sentences in third-person professional prose in English. Capture the project's essence and a key design decision. ALWAYS translate to English. Return null if there is not enough content.
- building_year (number | null): The year the project was completed or built (4-digit integer). Return null if not found.
- scope (string | null): The project scope. MUST be one of: "New Build", "Renovation", "Interior Design". Return null if unclear.
- location (string | null): City and/or country, e.g. "Amsterdam, Netherlands". Return null if not found.
- building_type (string | null): The type of building. MUST be one of: "villa", "house", "apartment", "townhouse", "penthouse", "bungalow", "chalet", "farm", "garden-house", "other". Return null if unclear.
- style (string | null): The design style. MUST be one of: "modern", "minimalist", "contemporary", "scandinavian", "industrial", "mid-century-modern", "traditional", "transitional", "eclectic", "farmhouse", "coastal", "mediterranean", "bohemian", "rustic", "urban-modern". Return null if unclear.`,
    messages: [
      {
        role: "user",
        content: `Page URL: ${pageUrl}\n\nPage text:\n${pageText}`,
      },
    ],
  })

  const rawText = message.content.find((b) => b.type === "text")?.text ?? "{}"
  const text = rawText.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
  const parsed = JSON.parse(text)

  const currentYear = new Date().getFullYear()
  const year = parseInt(parsed.building_year, 10)

  const validScopes = ["New Build", "Renovation", "Interior Design"]
  const validBuildingTypes = ["villa", "house", "apartment", "townhouse", "penthouse", "bungalow", "chalet", "farm", "garden-house", "other"]
  const validStyles = ["modern", "minimalist", "contemporary", "scandinavian", "industrial", "mid-century-modern", "traditional", "transitional", "eclectic", "farmhouse", "coastal", "mediterranean", "bohemian", "rustic", "urban-modern"]

  const rawScope = typeof parsed.scope === "string" ? parsed.scope.trim() : null
  const rawBuildingType = typeof parsed.building_type === "string" ? parsed.building_type.trim().toLowerCase() : null
  const rawStyle = typeof parsed.style === "string" ? parsed.style.trim().toLowerCase() : null

  return {
    title: typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim().slice(0, 120)
      : "Untitled Project",
    description: typeof parsed.description === "string" && parsed.description.trim()
      ? parsed.description.trim().slice(0, 320)
      : null,
    building_year: !isNaN(year) && year >= 1800 && year <= currentYear + 1 ? year : null,
    scope: rawScope && validScopes.includes(rawScope) ? rawScope : null,
    location: typeof parsed.location === "string" && parsed.location.trim()
      ? parsed.location.trim().slice(0, 120)
      : null,
    building_type: rawBuildingType && validBuildingTypes.includes(rawBuildingType) ? rawBuildingType : null,
    style: rawStyle && validStyles.includes(rawStyle) ? rawStyle : null,
    is_relevant_project: parsed.is_relevant_project === true,
  }
}

/** Fallback: extract basic fields from jsdom meta tags */
function extractWithJsdom(doc: Document): ExtractedProject {
  const getMeta = (selector: string, attr = "content") =>
    doc.querySelector(selector)?.getAttribute(attr)?.trim() ?? ""

  const title = cleanPageTitle(
    getMeta('meta[property="og:title"]') ||
    getMeta('meta[name="title"]') ||
    doc.querySelector("h1")?.textContent?.trim() ||
    doc.title?.trim() ||
    "Untitled Project"
  )

  const description = (
    getMeta('meta[property="og:description"]') ||
    getMeta('meta[name="description"]') ||
    ""
  ).slice(0, 800) || null

  let building_year: number | null = null
  try {
    const jsonLdEl = doc.querySelector('script[type="application/ld+json"]')
    if (jsonLdEl?.textContent) {
      const ld = JSON.parse(jsonLdEl.textContent)
      const raw = ld.dateCreated ?? ld.datePublished ?? ld.year
      if (raw) {
        const parsed = parseInt(String(raw).slice(0, 4), 10)
        const currentYear = new Date().getFullYear()
        if (!isNaN(parsed) && parsed >= 1800 && parsed <= currentYear) {
          building_year = parsed
        }
      }
    }
  } catch { /* ignore malformed JSON-LD */ }

  return { title, description, building_year, scope: null, location: null, building_type: null, style: null, is_relevant_project: true }
}

// ─── Main scrape action ──────────────────────────────────────────────────────

export async function scrapeAndCreateProject(rawUrl: string): Promise<ScrapeResult> {
  // 1. Auth
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in." }

  // 2. Rate limit — 5 scrapes per user per hour
  const rl = await checkRateLimit(`scrape:${user.id}`, { limit: 5, window: 3600 })
  if (!rl.success) return { error: "Too many attempts. Please try again in an hour." }

  // 3. URL validation
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { error: "Please enter a valid URL (including https://)." }
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return { error: "Only http/https URLs are supported." }
  }

  // 3b. Domain verification — URL must match company's verified domain
  const { data: proRow } = await supabase
    .from("professionals")
    .select("company_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!proRow?.company_id) {
    return { error: "You need a company profile to import projects." }
  }

  const { data: companyRow } = await supabase
    .from("companies")
    .select("domain, is_verified")
    .eq("id", proRow.company_id)
    .maybeSingle()

  // TODO: Remove development bypass after testing
  if (process.env.NODE_ENV !== "development") {
    if (!companyRow?.domain) {
      return { error: "Add your website domain in company settings before importing." }
    }
    if (!companyRow.is_verified) {
      return { error: "Verify your website domain in company settings before importing." }
    }

    const stripWww = (h: string) => h.replace(/^www\./, "").toLowerCase()
    const companyDomain = stripWww(companyRow.domain.replace(/^https?:\/\//i, "").split("/")[0])
    const urlDomain = stripWww(url.hostname)

    if (urlDomain !== companyDomain) {
      return { error: `This URL doesn't match your verified domain (${companyDomain}).` }
    }
  }

  // 3c. Check for duplicate imports — same URL already imported by this user's company
  if (proRow?.company_id) {
    const normalizedUrl = url.toString().replace(/\/+$/, "").toLowerCase()
    const { data: existingProjects } = await supabase
      .from("project_professionals")
      .select("project_id, projects!inner(slug)")
      .eq("company_id", proRow.company_id)
      .eq("is_project_owner", true)

    if (existingProjects?.length) {
      // Check slugs derived from the URL path (e.g. /projecten/villa-enschede → villa-enschede)
      const urlPath = url.pathname.replace(/\/+$/, "").split("/").pop() ?? ""
      const urlSlug = urlPath.toLowerCase().replace(/[^a-z0-9-]/g, "")

      const duplicate = existingProjects.find((pp: any) => {
        const projectSlug = (pp.projects?.slug ?? "").toLowerCase()
        return urlSlug && projectSlug.startsWith(urlSlug)
      })

      if (duplicate) {
        return {
          projectId: duplicate.project_id,
          title: "Existing project",
          duplicate: true,
        } as any
      }
    }
  }

  // 4. Fetch and extract page content
  let pageText: string
  let imageUrls: string[]
  let extracted: ExtractedProject

  if (process.env.FIRECRAWL_API_KEY) {
    // ── Primary: Firecrawl (handles JS rendering, anti-bot, lazy images) ──
    try {
      const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY })
      const result = await firecrawl.scrape(url.toString(), {
        formats: ["markdown"],
        timeout: 30000,
      }) as any

      if (!result || (!result.markdown && !result.metadata)) {
        return { error: "Could not fetch that page. Is the site publicly accessible?" }
      }

      pageText = (result.markdown ?? "").slice(0, 6000)
      const ogImage = result.metadata?.ogImage ?? undefined
      imageUrls = extractImagesFromMarkdown(result.markdown ?? "", url.toString(), ogImage)

      // Extract structured data with Claude (or basic fallback)
      console.log("[scrape] ANTHROPIC_API_KEY set:", !!process.env.ANTHROPIC_API_KEY, "pageText length:", pageText.length)
      if (process.env.ANTHROPIC_API_KEY && pageText.length > 50) {
        try {
          extracted = await extractWithClaude(pageText, url.toString())
        } catch (err) {
          logger.error("Claude extraction failed", { url: url.toString() }, err as Error)
          // Basic fallback from Firecrawl metadata
          extracted = {
            title: cleanPageTitle(result.metadata?.title ?? result.metadata?.ogTitle ?? "Untitled Project"),
            description: (result.metadata?.description ?? result.metadata?.ogDescription ?? null)?.slice(0, 320) ?? null,
            building_year: null,
            scope: null,
            location: null,
            building_type: null,
            style: null,
          }
        }
      } else {
        extracted = {
          title: (result.metadata?.title ?? result.metadata?.ogTitle ?? "Untitled Project").slice(0, 120),
          description: (result.metadata?.description ?? result.metadata?.ogDescription ?? null)?.slice(0, 320) ?? null,
          building_year: null,
          building_type: null,
          location: null,
          project_type: null,
          style: null,
        }
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err)
      logger.error("Firecrawl scrape failed", { url: url.toString(), firecrawlError: msg }, err as Error)
      // Surface the actual error for debugging — common issues: invalid API key, rate limit, unreachable URL
      if (msg.includes("401") || msg.includes("Unauthorized")) {
        return { error: "Scraping service authentication failed. Please check API key configuration." }
      }
      return { error: `Could not scrape that page: ${msg}` }
    }
  } else {
    // ── Fallback: fetch + JSDOM (no JS rendering) ──
    let html: string
    try {
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ArcoBot/1.0; +https://arco.nl)" },
        signal: AbortSignal.timeout(12000),
      })
      if (!res.ok) return { error: `Could not fetch that page (${res.status}).` }
      const ct = res.headers.get("content-type") ?? ""
      if (!ct.includes("text/html")) return { error: "That URL does not appear to be a web page." }
      html = await res.text()
    } catch (err) {
      logger.error("Scrape fetch failed", { url: url.toString() }, err as Error)
      return { error: "Could not reach that URL. Is the site publicly accessible?" }
    }

    const dom = new JSDOM(html, { url: url.toString() })
    const doc = dom.window.document

    imageUrls = extractImagesFromDom(doc, url.toString())

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        pageText = extractReadableText(doc)
        extracted = await extractWithClaude(pageText, url.toString())
      } catch (err) {
        logger.error("Claude extraction failed, falling back to jsdom", { url: url.toString() }, err as Error)
        extracted = extractWithJsdom(doc)
      }
    } else {
      extracted = extractWithJsdom(doc)
    }
  }

  // 5. Content relevance check
  if (!extracted.is_relevant_project) {
    return { error: "This page doesn't appear to be a project. Please link to a specific project page (e.g. a villa, renovation, or interior design project)." }
  }

  const { title, description, building_year, scope, location, building_type, style } = extracted
  console.log("[scrape] Extracted:", { title, scope, building_type, style, location, building_year })

  // 6b. Resolve building_type slug to category UUID (for Type field)
  let buildingTypeCategoryId: string | null = null
  if (building_type) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", building_type)
      .maybeSingle()
    buildingTypeCategoryId = cat?.id ?? null
    console.log(`[scrape] Building type "${building_type}" → category ID:`, buildingTypeCategoryId)
  }

  // 6c. Resolve style slug to taxonomy option UUID
  let styleOptionId: string | null = null
  if (style) {
    const { data: styleOpt } = await supabase
      .from("project_taxonomy_options")
      .select("id")
      .eq("slug", style)
      .eq("taxonomy_type", "project_style")
      .maybeSingle()
    styleOptionId = styleOpt?.id ?? null
    console.log(`[scrape] Style "${style}" → taxonomy ID:`, styleOptionId)
  }

  // 7. Generate unique slug and insert draft project
  // The slug check uses the authenticated client which is subject to RLS,
  // so we retry on unique constraint violations with a random suffix.
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "project"

  // 6d. Geocode location via Google Maps to get structured address + coordinates
  // Fallback: strip country from "City, Country" format
  let addressCity: string | null = location ? location.split(",")[0].trim() : null
  let addressRegion: string | null = null
  let addressFormatted: string | null = null
  let latitude: number | null = null
  let longitude: number | null = null

  if (location && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    try {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      const geoRes = await fetch(geocodeUrl)
      const geoData = await geoRes.json()

      if (geoData.status === "OK" && geoData.results?.[0]) {
        const result = geoData.results[0]
        addressFormatted = result.formatted_address ?? location
        latitude = result.geometry?.location?.lat ?? null
        longitude = result.geometry?.location?.lng ?? null

        // Extract city and region from address components
        for (const comp of result.address_components ?? []) {
          if (comp.types?.includes("locality")) {
            addressCity = comp.long_name
          }
          if (comp.types?.includes("administrative_area_level_1")) {
            addressRegion = comp.long_name
          }
        }
      }
    } catch (err) {
      logger.error("Geocode failed", { location }, err as Error)
    }
  }

  const projectData = {
    title,
    description,
    building_year,
    location: addressCity,
    address_city: addressCity,
    address_region: addressRegion,
    address_formatted: addressFormatted,
    latitude,
    longitude,
    project_type: scope,
    project_type_category_id: buildingTypeCategoryId,
    style_preferences: styleOptionId ? [styleOptionId] : null,
    status: "draft" as const,
    client_id: user.id,
  }

  let project: { id: string } | null = null

  // Try base slug first, then with random suffixes on collision
  const slugCandidates = [
    base,
    `${base}-${Math.random().toString(36).slice(2, 6)}`,
    `${base}-${Date.now()}`,
  ]

  for (const candidate of slugCandidates) {
    const { data, error: insertError } = await supabase
      .from("projects")
      .insert({ ...projectData, slug: candidate })
      .select("id")
      .single()

    if (data) {
      project = data
      break
    }

    // If it's a unique constraint violation, try the next slug
    if (insertError?.code === "23505") continue

    // Any other error is fatal
    logger.error("Scrape project insert failed", { userId: user.id }, insertError as Error)
    return { error: "Could not create the project. Please try again." }
  }

  if (!project) {
    return { error: "Could not generate a unique URL for this project. Please try again." }
  }

  // 8. Insert project category (for Type display in edit page)
  if (buildingTypeCategoryId) {
    await supabase
      .from("project_categories")
      .insert({ project_id: project.id, category_id: buildingTypeCategoryId, is_primary: true })
      .then(({ error }) => {
        if (error) logger.error("Scrape category insert failed", { projectId: project.id }, error as Error)
      })
  }

  // 9. Insert extracted images as project_photos
  if (imageUrls.length > 0) {
    const photoRows = imageUrls.map((imgUrl, i) => ({
      project_id: project.id,
      url: imgUrl,
      is_primary: i === 0,
      order_index: i,
    }))
    const { data: insertedPhotos, error: photoError } = await supabase
      .from("project_photos")
      .insert(photoRows)
      .select("id, url, order_index")
    if (photoError) {
      logger.error("Scrape photo insert failed", { projectId: project.id }, photoError as Error)
    }

    // 10. Auto-tag photos with spaces using Claude vision (best-effort)
    if (insertedPhotos && insertedPhotos.length > 0 && process.env.ANTHROPIC_API_KEY) {
      try {
        console.log(`[autoTag] Starting auto-tag for ${insertedPhotos.length} photos, project ${project.id}`)
        console.log(`[autoTag] Photo URLs:`, insertedPhotos.map(p => p.url))
        await autoTagPhotosWithSpaces(supabase, project.id, insertedPhotos)
        console.log(`[autoTag] Completed successfully`)
      } catch (err) {
        console.error(`[autoTag] Failed:`, err)
        logger.error("Auto-tag photos failed", { projectId: project.id }, err as Error)
        // Non-fatal — photos are still created, just untagged
      }
    }
  }

  // 11. Link project to user's company (so it appears in Listings)
  const { data: professional } = await supabase
    .from("professionals")
    .select("id, company_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (professional?.company_id) {
    // Fetch company's services to set invited_service_category_ids
    const { data: companyServices } = await supabase
      .from("companies")
      .select("primary_service_id, services_offered")
      .eq("id", professional.company_id)
      .maybeSingle()

    const serviceCategoryIds: string[] = []
    if (companyServices?.primary_service_id) {
      serviceCategoryIds.push(companyServices.primary_service_id)
    } else if (companyServices?.services_offered?.length) {
      serviceCategoryIds.push(companyServices.services_offered[0])
    }

    await supabase
      .from("project_professionals")
      .insert({
        project_id: project.id,
        professional_id: professional.id,
        company_id: professional.company_id,
        invited_email: user.email ?? "",
        is_project_owner: true,
        status: "live_on_page",
        invited_service_category_ids: serviceCategoryIds.length > 0 ? serviceCategoryIds : null,
      } as any)
      .then(({ error }) => {
        if (error) logger.error("Scrape project_professionals insert failed", { projectId: project.id }, error as Error)
      })
  }

  return { projectId: project.id, title }
}

// ─── Auto-tag photos with spaces ─────────────────────────────────────────────

async function autoTagPhotosWithSpaces(
  supabase: Awaited<ReturnType<typeof createServerActionSupabaseClient>>,
  projectId: string,
  photos: { id: string; url: string; order_index: number }[]
) {
  const Anthropic = (await import("@anthropic-ai/sdk")).default
  const client = new Anthropic()

  // Limit to 8 photos to avoid token limits and timeouts
  const photosToTag = photos.slice(0, 8)
  console.log(`[autoTag] Tagging ${photosToTag.length} of ${photos.length} photos`)

  // Build image content blocks for Claude vision
  const imageBlocks: any[] = []
  for (const photo of photosToTag) {
    imageBlocks.push(
      { type: "image", source: { type: "url", url: photo.url } },
      { type: "text", text: `Photo index: ${photo.order_index}` }
    )
  }

  const validSlugs = SPACE_SLUGS.join(", ")

  console.log(`[autoTag] Calling Claude vision...`)
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          {
            type: "text",
            text: `You are an expert at classifying architecture and interior design photos into room types.

For each photo above, determine which space/room it shows. Valid space slugs: ${validSlugs}

Rules (in priority order):
1. "pool" = any photo where a swimming pool is visible, indoor or outdoor. Always takes priority over other tags.
2. "exterior" = ANY outdoor photo that shows a building, house, structure, facade, roof, driveway, entrance, or any part of architecture. This includes: front/back/side views, aerial shots, twilight shots, construction progress, and any photo taken outside where a building is visible. THIS IS THE DEFAULT for outdoor photos — use it aggressively.
3. "garden" = outdoor area showing ONLY plants, greenery, lawn, landscaping with NO building visible. Very rare — if any part of a building is visible, use "exterior" instead.
4. "terrace" = photo clearly taken ON a terrace/balcony/patio, showing terrace furniture, decking, or railing as the main subject.
5. "living" = living room, lounge, sitting area, TV room
6. "kitchen" = kitchen, cooking area, pantry, dining area connected to kitchen
7. "bedroom" = bedroom, sleeping area, walk-in closet
8. "bathroom" = bathroom, shower, toilet, powder room, sauna
9. "home-office" = study, workspace, office room, library
10. "hallway" = entrance hall, corridor, staircase, landing, mudroom
11. "other" = LAST RESORT ONLY. Use this only for indoor spaces that truly cannot fit any category above (e.g. laundry room, wine cellar, gym, garage interior). NEVER use "other" for outdoor photos — those should be "exterior".

Critical: "other" should be rare. When uncertain, prefer a specific tag over "other". An outdoor photo with a building visible is ALWAYS "exterior", never "other".

Return a JSON array with one entry per photo, in order:
[{"index": 0, "space": "exterior"}, {"index": 1, "space": "kitchen"}, ...]

Return ONLY the JSON array, no other text.`,
          },
        ],
      },
    ],
  })

  const responseText = message.content.find((b) => b.type === "text")?.text?.trim() ?? "[]"
  console.log(`[autoTag] Claude response:`, responseText.substring(0, 500))

  // Parse the JSON response — handle markdown code blocks
  let classifications: { index: number; space: string }[]
  try {
    const cleaned = responseText.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
    classifications = JSON.parse(cleaned)
  } catch {
    logger.error("Auto-tag: could not parse Claude response", { projectId, responseText })
    return
  }

  // Use service role client to bypass RLS for spaces and project_features
  const serviceSupabase = createServiceRoleSupabaseClient()

  // Look up space IDs from the spaces table
  const { data: spaces, error: spacesError } = await serviceSupabase
    .from("spaces")
    .select("id, slug")
    .eq("is_active", true)

  console.log(`[autoTag] Spaces from DB:`, spaces?.length ?? 0, spaces?.map(s => s.slug), spacesError ? `Error: ${spacesError.message}` : "")
  if (!spaces || spaces.length === 0) return

  // Map from DB slugs to IDs
  const spaceMap = new Map(spaces.map((s) => [s.slug, s.id]))

  // Map from Claude's slugs to DB slugs (handle mismatches)
  const claudeToDbSlug: Record<string, string> = {
    "living": "living-room",
    "living-room": "living-room",
    "hallway": "exterior", // no hallway in DB, map to exterior
    "other": "exterior",   // no "other" in DB, fallback
  }

  // Group photos by space slug
  const photosBySpace = new Map<string, string[]>()
  for (const c of classifications) {
    const photo = photos.find((p) => p.order_index === c.index)
    if (!photo) continue
    // Resolve Claude's slug to a DB slug
    const rawSlug = c.space
    const dbSlug = claudeToDbSlug[rawSlug] ?? rawSlug
    // Only use if the DB slug exists in spaceMap
    const finalSlug = spaceMap.has(dbSlug) ? dbSlug : null
    if (!finalSlug) continue
    if (!photosBySpace.has(finalSlug)) photosBySpace.set(finalSlug, [])
    photosBySpace.get(finalSlug)!.push(photo.id)
  }

  // Create project_features for each detected space and link photos
  console.log(`[autoTag] Creating features for ${photosBySpace.size} spaces:`, Array.from(photosBySpace.keys()))
  let featureOrder = 0
  let tagged = 0
  for (const [spaceSlug, photoIds] of photosBySpace) {
    const spaceId = spaceMap.get(spaceSlug)
    if (!spaceId) {
      console.log(`[autoTag] No space ID for slug "${spaceSlug}", skipping`)
      continue
    }

    const spaceName = spaceSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

    // Create the project_feature
    const { data: feature, error: featureError } = await serviceSupabase
      .from("project_features")
      .insert({
        project_id: projectId,
        name: spaceName,
        space_id: spaceId,
        order_index: featureOrder++,
        is_highlighted: false,
        is_building_default: false,
      })
      .select("id")
      .single()

    if (featureError || !feature) {
      console.error(`[autoTag] Failed to create feature for "${spaceSlug}":`, featureError)
      continue
    }

    // Link photos to this feature
    const { error: linkError } = await serviceSupabase
      .from("project_photos")
      .update({ feature_id: feature.id })
      .in("id", photoIds)

    if (linkError) {
      console.error(`[autoTag] Failed to link photos to "${spaceSlug}":`, linkError)
    } else {
      tagged += photoIds.length
      console.log(`[autoTag] Tagged ${photoIds.length} photos as "${spaceSlug}"`)
    }
  }

  logger.info("Auto-tagged photos with spaces", {
    projectId,
    spacesDetected: photosBySpace.size,
    photosTagged: photos.length,
  })
}

export type RegenerateResult = { description: string } | { error: string }

export async function regenerateDescription(projectId: string): Promise<RegenerateResult> {
  // Auth
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated." }

  // Fetch current project state
  const { data: proj } = await supabase
    .from("projects")
    .select("title, description, building_year, location, building_type, project_type, address_city, style_preferences")
    .eq("id", projectId)
    .eq("client_id", user.id)
    .single()

  if (!proj) return { error: "Project not found." }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "AI generation is not configured." }
  }

  // Fetch project photos for visual context (up to 6)
  const { data: photos } = await supabase
    .from("project_photos")
    .select("url")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true })
    .limit(6)

  const context = [
    `Title: ${proj.title}`,
    proj.address_city     ? `City: ${proj.address_city}`              : null,
    proj.location         ? `Location: ${proj.location}`              : null,
    proj.building_year    ? `Year: ${proj.building_year}`             : null,
    proj.building_type    ? `Building type: ${proj.building_type}`    : null,
    proj.project_type     ? `Scope: ${proj.project_type}`             : null,
  ].filter(Boolean).join("\n")

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const client = new Anthropic()

    // Build message content with photos if available
    const content: any[] = []

    const photoUrls = (photos ?? []).filter(p => p.url).slice(0, 4)
    if (photoUrls.length > 0) {
      for (const photo of photoUrls) {
        content.push({ type: "image", source: { type: "url", url: photo.url } })
      }
    }

    content.push({
      type: "text",
      text: `Write exactly 2 sentences describing this architecture/interior design project for a professional portfolio. Third-person tone, under 300 characters total. Capture the project's character and one key design decision based on the photos and metadata. Return only the description text, no quotes.\n\n${context}`,
    })

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 180,
      messages: [{ role: "user", content }],
    })

    const text = message.content.find((b) => b.type === "text")?.text?.trim() ?? ""
    if (!text) return { error: "Could not generate description. Try again." }

    const description = text.slice(0, 320)

    // Save to DB
    await supabase.from("projects").update({ description }).eq("id", projectId)

    return { description }
  } catch (err) {
    logger.error("regenerateDescription failed", { projectId }, err as Error)
    return { error: "Generation failed. Please try again." }
  }
}
