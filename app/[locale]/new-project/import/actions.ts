"use server"

import { cookies } from "next/headers"
import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"

const LOCALE_NAMES: Record<string, string> = { nl: "Dutch", en: "English", de: "German", fr: "French" }
async function getDescriptionLocale(): Promise<string> {
  const cookieStore = await cookies()
  const locale = cookieStore.get("NEXT_LOCALE")?.value ?? "en"
  return LOCALE_NAMES[locale] ?? "English"
}
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

/**
 * Try to discover project images via CMS-specific API patterns.
 * Works for DNN (DotNetNuke) sites like mecanoo.nl where images are loaded via AJAX.
 */
async function tryDiscoverCmsImages(html: string, pageUrl: string): Promise<string[]> {
  const results: string[] = []
  const base = new URL(pageUrl)

  // DNN ProjectImagesService pattern: new ProjectImagesService($, {...}, moduleId, projectId)
  const dnnMatch = html.match(/new\s+ProjectImagesService\s*\(\s*\$\s*,\s*\{[^}]*\}\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/)
  if (dnnMatch) {
    const moduleId = dnnMatch[1]
    const projectId = dnnMatch[2]
    // DNN WebAPI endpoint pattern
    const apiPaths = [
      `/DesktopModules/MVC/Mecanoo.Projects/API/ProjectImage/List?projectId=${projectId}`,
      `/API/Mecanoo.Projects/ProjectImage/List?projectId=${projectId}`,
      `/DesktopModules/Mecanoo.Projects/API/ProjectImage/List?projectId=${projectId}`,
    ]
    for (const apiPath of apiPaths) {
      try {
        const apiUrl = `${base.origin}${apiPath}`
        const res = await fetch(apiUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ArcoBot/1.0)",
            "ModuleId": moduleId,
            "TabId": "0",
            "Accept": "application/json",
          },
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) continue
        const data = await res.json()
        const items = Array.isArray(data) ? data : data?.Results ?? data?.data ?? []
        for (const item of items) {
          const link = item.Link ?? item.FileName ?? item.ImageUrl ?? item.Url ?? item.src ?? ""
          if (link && /\.(jpe?g|png|webp)/i.test(link)) {
            try {
              // Build full URL from the image path pattern found in the page
              const imgPath = link.startsWith("/") ? link : `/Portals/_default/Mecanoo/PRProjects/${projectId}/${link}`
              results.push(new URL(imgPath, base.origin).toString())
            } catch {}
          }
        }
        if (results.length > 0) break
      } catch { continue }
    }
  }

  // Also try: find the project image base path and enumerate from page content
  if (results.length === 0) {
    const basePathMatch = html.match(/['"]([^'"]*\/PRProjects\/\d+\/)['"]/i)
      || html.match(/['"]([^'"]*\/Portals\/[^'"]*\/PRProjects\/\d+\/)['"]/i)
    if (basePathMatch) {
      const basePath = basePathMatch[1]
      // Find all image filenames referenced for this path
      const escapedPath = basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const fileRegex = new RegExp(`${escapedPath}([\\w\\-]+\\.(?:jpe?g|png|webp))`, "gi")
      let match
      while ((match = fileRegex.exec(html)) !== null) {
        try {
          results.push(new URL(basePath + match[1], base.origin).toString())
        } catch {}
      }
    }
  }

  return results
}

// ─── Firecrawl helpers ────────────────────────────────────────────────────────

/** Decode HTML entities and clean up image URLs */
function cleanImageSrc(src: string): string {
  // Decode HTML entities
  let cleaned = src
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim()
  // Strip surrounding quotes
  cleaned = cleaned.replace(/^["']|["']$/g, "")
  // If the URL contains an embedded URL (e.g. from malformed HTML), extract the inner one
  const embeddedMatch = cleaned.match(/(https?:\/\/[^\s"']+\.(?:jpe?g|png|webp)(?:\?[^\s"']*)?)/i)
  if (embeddedMatch && embeddedMatch[1] !== cleaned) {
    cleaned = embeddedMatch[1]
  }
  return cleaned
}

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

  const add = (rawSrc: string) => {
    try {
      const src = cleanImageSrc(rawSrc)
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

  return results.slice(0, 30)
}

/**
 * Extract images from raw HTML string — catches lazy-loaded images, srcset, data-src,
 * WordPress galleries, and other patterns missed by markdown extraction.
 */
function extractImagesFromRawHtml(html: string, baseUrl: string): string[] {
  const seen = new Set<string>()
  const results: string[] = []

  const add = (rawSrc: string) => {
    try {
      const src = cleanImageSrc(rawSrc)
      const abs = new URL(src, baseUrl).toString()
      const fullRes = upgradeToFullRes(abs)
      const key = fullRes || abs
      if (seen.has(key)) return
      if (/\.(svg|ico|gif)(\?|$)/i.test(key)) return
      if (/logo|icon|avatar|favicon|sprite|placeholder|gravatar/i.test(key)) return
      if (/data:image/i.test(key)) return
      seen.add(key)
      results.push(key)
    } catch {}
  }

  // Match src, data-src, data-lazy-src, data-original attributes
  const imgTagRegex = /<img[^>]+>/gi
  let match
  while ((match = imgTagRegex.exec(html)) !== null) {
    const tag = match[0]

    // Skip small images
    const widthMatch = tag.match(/width=["']?(\d+)/i)
    const heightMatch = tag.match(/height=["']?(\d+)/i)
    if (widthMatch && parseInt(widthMatch[1]) < 200) continue
    if (heightMatch && parseInt(heightMatch[1]) < 200) continue

    // Extract from various attributes
    for (const attr of ["data-src", "data-lazy-src", "data-original", "data-full", "src"]) {
      const attrMatch = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"))
      if (attrMatch?.[1] && !attrMatch[1].startsWith("data:")) {
        add(attrMatch[1])
      }
    }

    // Extract from srcset (take the largest)
    const srcsetMatch = tag.match(/srcset=["']([^"']+)["']/i)
    if (srcsetMatch?.[1]) {
      const candidates = srcsetMatch[1].split(",").map((s) => s.trim().split(/\s+/))
      // Sort by width descriptor (e.g. "1024w") descending
      candidates.sort((a, b) => {
        const aW = parseInt(a[1]?.replace("w", "") ?? "0")
        const bW = parseInt(b[1]?.replace("w", "") ?? "0")
        return bW - aW
      })
      if (candidates[0]?.[0]) add(candidates[0][0])
    }
  }

  // Match WordPress gallery links: <a href="...jpg">
  const linkRegex = /<a[^>]+href=["']([^"']+\.(?:jpe?g|png|webp))["'][^>]*>/gi
  while ((match = linkRegex.exec(html)) !== null) {
    add(match[1])
  }

  // Match background-image URLs in style attributes
  const bgRegex = /background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)/gi
  while ((match = bgRegex.exec(html)) !== null) {
    if (!match[1].startsWith("data:")) add(match[1])
  }

  // Match data-image, data-bg, data-thumb and similar attributes on any element
  const dataAttrRegex = /data-(?:image|bg|thumb|full|large|zoom|hi-res|hires|original-src|src-retina)=["']([^"']+)["']/gi
  while ((match = dataAttrRegex.exec(html)) !== null) {
    if (!match[1].startsWith("data:")) add(match[1])
  }

  // Match image URLs in inline JavaScript (common gallery/slider patterns)
  // Catches: image.Link patterns, JSON image arrays, and quoted image paths
  const jsImageRegex = /["']([^"']*\/(?:PRProjects|projects|portfolio|gallery|uploads|images|media|wp-content\/uploads)\/[^"']*\.(?:jpe?g|png|webp))["']/gi
  while ((match = jsImageRegex.exec(html)) !== null) {
    add(match[1])
  }

  // Match common JS gallery data: {src: "...", url: "...", image: "..."}
  const jsObjRegex = /(?:src|url|image|href|path|file)["']?\s*[:=]\s*["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi
  while ((match = jsObjRegex.exec(html)) !== null) {
    if (!match[1].startsWith("data:") && match[1].length > 10) add(match[1])
  }

  return results.slice(0, 30)
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

  const add = (rawSrc: string) => {
    try {
      const src = cleanImageSrc(rawSrc)
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
    const src = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || img.getAttribute("data-original")
    if (!src) return
    const w = parseInt(img.getAttribute("width") ?? "0", 10)
    const h = parseInt(img.getAttribute("height") ?? "0", 10)
    if ((w && w < 200) || (h && h < 200)) return
    add(src)
  })

  // Extract background-image from style attributes
  mainEl?.querySelectorAll("[style]").forEach((el) => {
    const style = el.getAttribute("style") ?? ""
    const bgMatch = style.match(/background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)/i)
    if (bgMatch?.[1] && !bgMatch[1].startsWith("data:")) add(bgMatch[1])
  })

  // Extract image URLs from inline scripts (JS galleries)
  const fullHtml = doc.documentElement.outerHTML
  const jsImageRegex = /["']([^"']*\/(?:PRProjects|projects|portfolio|gallery|uploads|images|media|wp-content\/uploads)\/[^"']*\.(?:jpe?g|png|webp))["']/gi
  let jsMatch
  while ((jsMatch = jsImageRegex.exec(fullHtml)) !== null) {
    add(jsMatch[1])
  }

  return results.slice(0, 30)
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

export async function scrapeAndCreateProject(rawUrl: string, adminCompanyId?: string): Promise<ScrapeResult> {
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

  // Admin mode: skip domain verification, use provided company ID
  let resolvedCompanyId: string | null = adminCompanyId ?? null

  if (!adminCompanyId) {
    // 3b. Domain verification — URL must match company's verified domain
    const { data: proRow } = await supabase
      .from("professionals")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!proRow?.company_id) {
      return { error: "You need a company profile to import projects." }
    }

    resolvedCompanyId = proRow.company_id

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
  }

  // 3c. Check for duplicate imports — same source URL already imported
  const normalizedUrl = url.toString().replace(/\/+$/, "").toLowerCase()
  {
    const { data: existingProject } = await supabase
      .from("projects")
      .select("id")
      .eq("source_url", normalizedUrl)
      .maybeSingle()

    if (existingProject) {
      return {
        projectId: existingProject.id,
        title: "Existing project",
        duplicate: true,
      } as any
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
        formats: ["markdown", "html"],
        timeout: 45000,
        waitFor: 10000,
      }) as any

      if (!result || (!result.markdown && !result.metadata)) {
        return { error: "Could not fetch that page. Is the site publicly accessible?" }
      }

      pageText = (result.markdown ?? "").slice(0, 6000)
      const ogImage = result.metadata?.ogImage ?? undefined
      imageUrls = extractImagesFromMarkdown(result.markdown ?? "", url.toString(), ogImage)

      // Also extract images from raw HTML (catches lazy-loaded, srcset, data-src, JS galleries)
      if (result.html) {
        const htmlImages = extractImagesFromRawHtml(result.html, url.toString())
        for (const img of htmlImages) {
          if (!imageUrls.includes(img)) imageUrls.push(img)
        }
      }

      // Extract from full raw HTML including script blocks (for AJAX-loaded galleries)
      if (result.rawHtml || result.html) {
        const fullHtml = result.rawHtml ?? result.html
        const rawHtmlImages = extractImagesFromRawHtml(fullHtml, url.toString())
        for (const img of rawHtmlImages) {
          if (!imageUrls.includes(img)) imageUrls.push(img)
        }
      }

      // If we found very few images, try CMS-specific API discovery
      if (imageUrls.length < 4 && (result.html || result.rawHtml)) {
        try {
          const cmsImages = await tryDiscoverCmsImages(result.rawHtml ?? result.html, url.toString())
          for (const img of cmsImages) {
            if (!imageUrls.includes(img)) imageUrls.push(img)
          }
          if (cmsImages.length > 0) {
            console.log(`[scrape] CMS discovery found ${cmsImages.length} additional images`)
          }
        } catch (err) {
          console.log("[scrape] CMS image discovery failed:", err)
        }
      }

      imageUrls = imageUrls.slice(0, 30)
      console.log(`[scrape] Found ${imageUrls.length} images from ${url.toString()}`)

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

    // If few images found, try CMS-specific API discovery
    if (imageUrls.length < 4) {
      try {
        const cmsImages = await tryDiscoverCmsImages(html, url.toString())
        for (const img of cmsImages) {
          if (!imageUrls.includes(img)) imageUrls.push(img)
        }
      } catch {}
      imageUrls = imageUrls.slice(0, 30)
    }

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

  // Store initial title + description in translations (AI extraction always returns English)
  const initialTranslations: Record<string, any> = {}
  if (title || description) {
    initialTranslations.en = {}
    if (title) initialTranslations.en.title = title
    if (description) initialTranslations.en.description = description
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
    source_url: url.toString().replace(/\/+$/, "").toLowerCase(),
    translations: initialTranslations,
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

  // 11. Link project to company (so it appears in Listings)
  const targetCompanyId = resolvedCompanyId ?? null

  if (adminCompanyId && targetCompanyId) {
    // Admin mode: link project to the target company using service role
    const { createServiceRoleSupabaseClient } = await import("@/lib/supabase/server")
    const serviceClient = createServiceRoleSupabaseClient()

    const { data: companyServices } = await serviceClient
      .from("companies")
      .select("primary_service_id, services_offered")
      .eq("id", targetCompanyId)
      .maybeSingle()

    const serviceCategoryIds: string[] = []
    if (companyServices?.primary_service_id) {
      serviceCategoryIds.push(companyServices.primary_service_id)
    } else if (companyServices?.services_offered?.length) {
      serviceCategoryIds.push(companyServices.services_offered[0])
    }

    await serviceClient
      .from("project_professionals")
      .insert({
        project_id: project.id,
        company_id: targetCompanyId,
        invited_email: "",
        is_project_owner: true,
        status: "live_on_page",
        invited_service_category_ids: serviceCategoryIds.length > 0 ? serviceCategoryIds : null,
      } as any)
      .then(({ error }) => {
        if (error) logger.error("Admin scrape project_professionals insert failed", { projectId: project.id }, error as Error)
      })
  } else {
    // Normal mode: link to user's own company
    const { data: professional } = await supabase
      .from("professionals")
      .select("id, company_id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (professional?.company_id) {
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
  }

  // Translate title and description to Dutch in the background
  if ((title || description) && process.env.ANTHROPIC_API_KEY) {
    (async () => {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default
        const client = new Anthropic()
        const parts: string[] = []
        if (title) parts.push(`Title: ${title}`)
        if (description) parts.push(`Description: ${description}`)

        const msg = await client.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 400,
          messages: [{
            role: "user",
            content: `Translate the following to Dutch. Return a JSON object with "title" and "description" keys (only include keys that were provided). Keep the same tone and style. Return only JSON, no markdown.\n\n${parts.join("\n")}`,
          }],
        })
        const rawText = msg.content.find((b) => b.type === "text")?.text?.trim() ?? ""
        const cleaned = rawText.replace(/```json\s*|```\s*/g, "").trim()
        const parsed = JSON.parse(cleaned)

        const { data: existing } = await supabase.from("projects").select("translations").eq("id", project!.id).single()
        const translations = (existing?.translations as Record<string, any>) ?? {}
        if (!translations.nl) translations.nl = {}
        if (parsed.title) translations.nl.title = String(parsed.title).slice(0, 120)
        if (parsed.description) translations.nl.description = String(parsed.description).slice(0, 750)

        await supabase.from("projects").update({ translations }).eq("id", project!.id)
      } catch {
        // Non-fatal — Dutch translation will be generated later via regenerateDescription
      }
    })()
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

  // Filter out malformed URLs before tagging
  const validPhotos = photos.filter((p) => {
    try {
      const u = new URL(p.url)
      return u.protocol === "https:" || u.protocol === "http:"
    } catch { return false }
  })

  // Tag up to 20 photos with compact prompt to stay within Haiku vision limits
  const photosToTag = validPhotos.slice(0, 20)
  console.log(`[autoTag] Tagging ${photosToTag.length} of ${photos.length} photos (${photos.length - validPhotos.length} skipped as invalid)`)

  if (photosToTag.length === 0) return

  // Build image content blocks — use minimal text between images
  const imageBlocks: any[] = []
  for (const photo of photosToTag) {
    imageBlocks.push(
      { type: "image", source: { type: "url", url: photo.url } },
      { type: "text", text: `#${photo.order_index}` }
    )
  }

  console.log(`[autoTag] Calling Claude vision...`)
  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          {
            type: "text",
            text: `Classify each photo into a space and determine overall project attributes.

Spaces: exterior (outside view of building — facade, roof, entrance, driveway, aerial, twilight. DEFAULT for any outdoor photo showing a building), pool (swimming pool visible), garden (only plants/lawn, NO building visible), terrace (on a terrace/balcony/patio), living (living room, lounge, sitting area), kitchen (kitchen, pantry, dining connected to kitchen), bedroom (bedroom, walk-in closet), bathroom (bathroom, shower, toilet, sauna), home-office (study, workspace, library), hallway (entrance hall, corridor, staircase), other (last resort — indoor only)

Rules: outdoor photo with building visible = always "exterior". Tag every photo. Never skip.

Also determine: style (modern/contemporary/traditional/minimalist/industrial/scandinavian/mediterranean/rustic/mid-century-modern/bohemian/coastal/farmhouse/transitional/urban-modern/eclectic), scope (new-build/renovated/interior-designed), building_type (villa/house/apartment/townhouse/penthouse/bungalow/chalet/farm/garden-house/other). Always pick one for each.

Return ONLY this JSON:
{"photos":[{"index":0,"space":"exterior"}],"style":"modern","scope":"new-build","building_type":"villa"}`,
          },
        ],
      },
    ],
  })

  const responseText = message.content.find((b) => b.type === "text")?.text?.trim() ?? "{}"
  console.log(`[autoTag] Claude response:`, responseText.substring(0, 800))

  // Parse the JSON response — handle markdown code blocks
  let classifications: { index: number; space: string }[]
  let detectedStyle: string | null = null
  let detectedScope: string | null = null
  let detectedBuildingType: string | null = null
  try {
    const cleaned = responseText.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
    const parsed = JSON.parse(cleaned)
    // Support both old array format and new object format
    if (Array.isArray(parsed)) {
      classifications = parsed
    } else {
      classifications = parsed.photos ?? []
      detectedStyle = typeof parsed.style === "string" ? parsed.style.trim().toLowerCase() : null
      detectedScope = typeof parsed.scope === "string" ? parsed.scope.trim().toLowerCase() : null
      detectedBuildingType = typeof parsed.building_type === "string" ? parsed.building_type.trim().toLowerCase() : null
    }
    console.log(`[autoTag] Detected style: ${detectedStyle}, scope: ${detectedScope}, building_type: ${detectedBuildingType}`)
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
    "living-room": "living",
    "living_room": "living",
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

  // Fetch existing project_features so we can reuse them instead of creating duplicates
  const { data: existingFeatures } = await serviceSupabase
    .from("project_features")
    .select("id, space_id, name, is_building_default")
    .eq("project_id", projectId)

  const existingBySpaceId = new Map<string, string>()
  const existingByName = new Map<string, string>()
  for (const f of existingFeatures ?? []) {
    if (f.space_id) existingBySpaceId.set(f.space_id, f.id)
    if (f.name) existingByName.set(f.name.toLowerCase(), f.id)
  }

  // Determine next order_index
  const maxExistingOrder = (existingFeatures ?? []).reduce(
    (max, f) => Math.max(max, (f as any).order_index ?? 0), 0
  )

  // Create or reuse project_features for each detected space and link photos
  console.log(`[autoTag] Linking ${photosBySpace.size} spaces:`, Array.from(photosBySpace.keys()))
  let featureOrder = maxExistingOrder + 1
  let tagged = 0
  for (const [spaceSlug, photoIds] of photosBySpace) {
    const spaceId = spaceMap.get(spaceSlug)
    if (!spaceId) {
      console.log(`[autoTag] No space ID for slug "${spaceSlug}", skipping`)
      continue
    }

    const spaceName = spaceSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

    // Try to reuse an existing feature: match by space_id first, then by name
    let featureId = existingBySpaceId.get(spaceId)
      ?? existingByName.get(spaceName.toLowerCase())
      ?? null

    if (featureId) {
      // Update existing feature to set space_id if it was missing
      await serviceSupabase
        .from("project_features")
        .update({ space_id: spaceId })
        .eq("id", featureId)
      console.log(`[autoTag] Reusing existing feature "${spaceName}" (${featureId})`)
    } else {
      // Create a new feature
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
      featureId = feature.id
      console.log(`[autoTag] Created new feature "${spaceName}" (${featureId})`)
    }

    // Link photos to this feature — update one at a time to avoid
    // "tuple already modified" error from the ensure_single_primary_photo trigger
    let linkedCount = 0
    for (const photoId of photoIds) {
      const { error: linkError } = await serviceSupabase
        .from("project_photos")
        .update({ feature_id: featureId })
        .eq("id", photoId)

      if (linkError) {
        console.error(`[autoTag] Failed to link photo ${photoId} to "${spaceSlug}":`, linkError)
      } else {
        linkedCount++
      }
    }
    tagged += linkedCount
    console.log(`[autoTag] Tagged ${linkedCount}/${photoIds.length} photos as "${spaceSlug}"`)
  }

  logger.info("Auto-tagged photos with spaces", {
    projectId,
    spacesDetected: photosBySpace.size,
    photosTagged: tagged,
  })

  // Save vision-detected style and scope as taxonomy selections (fills gaps from text extraction)
  const taxonomyInserts: { project_id: string; taxonomy_option_id: string }[] = []

  if (detectedStyle) {
    const { data: styleOpt } = await serviceSupabase
      .from("project_taxonomy_options")
      .select("id")
      .eq("slug", detectedStyle)
      .eq("taxonomy_type", "project_style")
      .maybeSingle()
    if (styleOpt) {
      // Check if style already set
      const { data: existing } = await serviceSupabase
        .from("project_taxonomy_selections")
        .select("id")
        .eq("project_id", projectId)
        .eq("taxonomy_option_id", styleOpt.id)
        .maybeSingle()
      if (!existing) {
        taxonomyInserts.push({ project_id: projectId, taxonomy_option_id: styleOpt.id })
      }
      // Also update projects.style_preferences if empty
      await serviceSupabase
        .from("projects")
        .update({ style_preferences: [styleOpt.id] })
        .eq("id", projectId)
        .is("style_preferences", null)
    }
  }

  if (detectedScope) {
    const scopeToSlug: Record<string, string> = {
      "new-build": "new-build",
      "new_build": "new-build",
      "renovated": "renovated",
      "renovation": "renovated",
      "interior-designed": "interior-designed",
      "interior_designed": "interior-designed",
      "interior design": "interior-designed",
    }
    const scopeSlug = scopeToSlug[detectedScope] ?? detectedScope
    const { data: scopeOpt } = await serviceSupabase
      .from("project_taxonomy_options")
      .select("id")
      .eq("slug", scopeSlug)
      .eq("taxonomy_type", "building_type")
      .maybeSingle()
    if (scopeOpt) {
      const { data: existing } = await serviceSupabase
        .from("project_taxonomy_selections")
        .select("id")
        .eq("project_id", projectId)
        .eq("taxonomy_option_id", scopeOpt.id)
        .maybeSingle()
      if (!existing) {
        taxonomyInserts.push({ project_id: projectId, taxonomy_option_id: scopeOpt.id })
      }
      // Also update projects.project_type if empty
      const scopeLabel: Record<string, string> = { "new-build": "New Build", "renovated": "Renovation", "interior-designed": "Interior Design" }
      await serviceSupabase
        .from("projects")
        .update({ project_type: scopeLabel[scopeSlug] ?? null })
        .eq("id", projectId)
        .is("project_type", null)
    }
  }

  // Save building type to projects.building_type and category if empty
  if (detectedBuildingType) {
    const validTypes = ["villa", "house", "apartment", "townhouse", "penthouse", "bungalow", "chalet", "farm", "garden-house", "other"]
    if (validTypes.includes(detectedBuildingType)) {
      // Update projects.building_type if empty
      await serviceSupabase
        .from("projects")
        .update({ building_type: detectedBuildingType })
        .eq("id", projectId)
        .is("building_type", null)

      // Also set project_type_category_id if empty
      const { data: cat } = await serviceSupabase
        .from("categories")
        .select("id")
        .eq("slug", detectedBuildingType)
        .maybeSingle()
      if (cat) {
        await serviceSupabase
          .from("projects")
          .update({ project_type_category_id: cat.id })
          .eq("id", projectId)
          .is("project_type_category_id", null)
      }
      console.log(`[autoTag] Set building_type: ${detectedBuildingType}`)
    }
  }

  if (taxonomyInserts.length > 0) {
    const { error: taxError } = await serviceSupabase
      .from("project_taxonomy_selections")
      .insert(taxonomyInserts)
    if (taxError) {
      console.error(`[autoTag] Failed to save taxonomy selections:`, taxError)
    } else {
      console.log(`[autoTag] Saved ${taxonomyInserts.length} taxonomy selections (style/scope/type)`)
    }
  }
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

    const userLocale = await getDescriptionLocale()

    content.push({
      type: "text",
      text: `Write a short description of this architecture/interior design project for a professional portfolio. 3-4 sentences, 60-80 words. Third-person tone, professional and warm. Capture the project's character, context, and one or two key design decisions based on the photos and metadata.

Also translate the project title to both English and Dutch.

Return a JSON object with "en" and "nl" keys, each containing "description" and "title" in that language. Example: {"en": {"title": "English title", "description": "English description..."}, "nl": {"title": "Dutch title", "description": "Dutch description..."}}
Return ONLY the JSON, no markdown code fences or other text.

${context}`,
    })

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      messages: [{ role: "user", content }],
    })

    const rawText = message.content.find((b) => b.type === "text")?.text?.trim() ?? ""
    if (!rawText) return { error: "Could not generate description. Try again." }

    // Parse bilingual response
    let enDesc = ""
    let nlDesc = ""
    let enTitle = ""
    let nlTitle = ""
    try {
      const cleaned = rawText.replace(/```json\s*|```\s*/g, "").trim()
      const parsed = JSON.parse(cleaned)
      // Support both flat {"en": "...", "nl": "..."} and nested {"en": {"title": "...", "description": "..."}}
      if (typeof parsed.en === "object") {
        enDesc = (parsed.en?.description ?? "").slice(0, 750)
        nlDesc = (parsed.nl?.description ?? "").slice(0, 750)
        enTitle = (parsed.en?.title ?? "").slice(0, 120)
        nlTitle = (parsed.nl?.title ?? "").slice(0, 120)
      } else {
        enDesc = (parsed.en ?? "").slice(0, 750)
        nlDesc = (parsed.nl ?? "").slice(0, 750)
      }
    } catch {
      // Fallback: use raw text as the user's locale
      enDesc = rawText.slice(0, 750)
      nlDesc = rawText.slice(0, 750)
    }

    // Use the user's locale as the primary description
    const description = userLocale === "Dutch" ? nlDesc : enDesc

    // Fetch existing translations to merge
    const { data: existing } = await supabase.from("projects").select("translations, title").eq("id", projectId).single()
    const translations = (existing?.translations as Record<string, any>) ?? {}
    translations.en = { ...(translations.en ?? {}), description: enDesc }
    translations.nl = { ...(translations.nl ?? {}), description: nlDesc }

    // Add title translations (use existing title as EN fallback)
    if (enTitle) translations.en.title = enTitle
    else if (existing?.title) translations.en.title = existing.title
    if (nlTitle) translations.nl.title = nlTitle

    // Update the main title if user locale is Dutch and we have a Dutch title
    const titleUpdate: Record<string, any> = { description, translations }
    if (userLocale === "Dutch" && nlTitle) {
      titleUpdate.title = nlTitle
    }

    // Save to DB
    await supabase.from("projects").update(titleUpdate).eq("id", projectId)

    return { description }
  } catch (err) {
    logger.error("regenerateDescription failed", { projectId }, err as Error)
    return { error: "Generation failed. Please try again." }
  }
}

/**
 * Save a project field (title or description) for a specific locale,
 * update the translations JSONB, and auto-translate the other language.
 */
export async function saveProjectTranslatedField(
  projectId: string,
  field: "title" | "description",
  value: string,
  locale: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated." }

  // Fetch existing translations
  const { data: proj } = await supabase
    .from("projects")
    .select("translations, title, description")
    .eq("id", projectId)
    .single()
  if (!proj) return { success: false, error: "Project not found." }

  const translations = (proj.translations as Record<string, any>) ?? {}
  if (!translations[locale]) translations[locale] = {}
  translations[locale][field] = value

  // Update the main column + translations
  const update: Record<string, any> = { [field]: value, translations }
  await supabase.from("projects").update(update).eq("id", projectId)

  // Auto-translate to the other language in the background
  const otherLocale = locale === "nl" ? "en" : "nl"
  const otherLang = locale === "nl" ? "English" : "Dutch"

  if (value && process.env.ANTHROPIC_API_KEY) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default
      const client = new Anthropic()
      const msg = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `Translate the following ${field === "title" ? "project title" : "project description"} to ${otherLang}. Keep the same tone and style. Return only the translated text, no quotes or labels.\n\n${value}`,
        }],
      })
      const translated = msg.content.find((b) => b.type === "text")?.text?.trim()
      if (translated) {
        if (!translations[otherLocale]) translations[otherLocale] = {}
        translations[otherLocale][field] = translated.slice(0, 750)
        await supabase.from("projects").update({ translations }).eq("id", projectId)
      }
    } catch {
      // Translation failed — non-fatal, the other locale just won't update
    }
  }

  return { success: true }
}
