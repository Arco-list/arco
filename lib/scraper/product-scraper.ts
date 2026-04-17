// Top-level product scraper. Step 1 of the brand-agnostic refactor:
// lifts the existing Firecrawl + Claude pipeline out of the admin action
// without changing behavior. Future steps add structured-data sniffers
// (__NEXT_DATA__, JSON-LD, Shopify) that short-circuit this fallback
// when a brand's site exposes its variant matrix directly.

import type { Firecrawl } from "@mendable/firecrawl-js"
import type Anthropic from "@anthropic-ai/sdk"
import type { RawVariant, ScrapedProduct } from "./types"
import { runSniffers } from "./sniffers"
import { inferAxes } from "./axis-inference"
import { scopeSpecs } from "./scope-specs"
import { dedupePhotos } from "./dedupe-photos"

export interface ScraperContext {
  firecrawl: Firecrawl
  anthropic: Anthropic
  brandName: string
  /** Pre-joined "slug: name, slug: name, …" for Claude's category classifier. */
  categoryList: string
}

export type ScrapeOutcome = ScrapedProduct | { error: string }

// Known color name → hex lookup for common finishes.
const COLOR_HEX: Record<string, string> = {
  "dark chrome": "#3a3a3a", "chrome": "#c0c0c0", "matt silver": "#b8b8b8", "silver": "#c0c0c0",
  "matt black": "#1a1a1a", "black": "#000000", "black phantom": "#2a2a2a", "phantom": "#4a4a4a",
  "matt white": "#f5f5f5", "white": "#ffffff",
  "bronze": "#cd7f32", "rose gold": "#b76e79", "gold": "#d4af37",
  "matt gold": "#c9a96e", "brass": "#b5a642", "brushed brass": "#c9a96e",
  "copper": "#b87333", "nickel": "#8e8e8e", "brushed nickel": "#a0a0a0",
  "anthracite": "#383838", "graphite": "#4b4b4b", "champagne": "#d4c5a9",
  "walnut": "#5c4033", "oak": "#c8a96e", "teak": "#b8860b",
}

export async function scrapeProductGeneric(
  url: URL,
  ctx: ScraperContext,
): Promise<ScrapeOutcome> {
  try {
    const mainResult = await ctx.firecrawl.scrape(url.toString(), {
      formats: ["markdown", "html"],
      timeout: 45000,
      waitFor: 8000,
    }) as any

    if (!mainResult?.markdown && !mainResult?.html) {
      return { error: "Could not fetch product page." }
    }

    // Try to also fetch a specifications/technical details sub-page
    let specsPageText = ""
    const specsUrls = [
      url.toString().replace(/\/?$/, "/specifications"),
      url.toString().replace(/\/?$/, "/technical"),
      url.toString().replace(/\/?$/, "/specs"),
    ]
    for (const specsUrl of specsUrls) {
      try {
        const specsResult = await ctx.firecrawl.scrape(specsUrl, {
          formats: ["markdown"],
          timeout: 20000,
          waitFor: 5000,
        }) as any
        if (specsResult?.markdown && specsResult.markdown.length > 200) {
          specsPageText = specsResult.markdown.slice(0, 4000)
          console.log(`[scrape] Found specs sub-page at ${specsUrl} (${specsPageText.length} chars)`)
          break
        }
      } catch {}
    }

    // Extract gallery images from markdown. Raw URLs are collected first;
    // deduplication + logo/icon filtering + resolution picking happen in
    // dedupePhotos (shared util so sniffer + markdown paths stay aligned).
    let photos: string[] = []
    {
      const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g
      const seen = new Set<string>()
      const raw: string[] = []
      let match
      while ((match = imgRegex.exec(mainResult.markdown ?? "")) !== null) {
        try {
          const abs = new URL(match[1], url.toString()).toString()
          if (seen.has(abs)) continue
          seen.add(abs)
          raw.push(abs)
        } catch {}
      }
      photos = dedupePhotos(raw.map((u) => ({ url: u })))
    }

    const mainPageText = (mainResult.markdown ?? "").slice(0, 5000)
    const pageText = specsPageText
      ? `${mainPageText}\n\n--- SPECIFICATIONS TAB ---\n${specsPageText}`
      : mainPageText

    // Firecrawl's cleaned `html` strips inline <script id="__NEXT_DATA__">
    // tags that many Next.js commerce sites (Moooi, Centra-on-Next) use to
    // expose their full variant matrix. Fetch the raw page once so the
    // sniffers get the untouched markup; fall back to Firecrawl's html if
    // the direct fetch fails (CORS-ish network errors, 403s, etc.).
    let html = mainResult.html ?? mainResult.rawHtml ?? ""
    try {
      const rawRes = await fetch(url.toString(), {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(15000),
      })
      if (rawRes.ok) {
        const rawHtml = await rawRes.text()
        if (/__NEXT_DATA__|application\/ld\+json|Shopify\.product/.test(rawHtml)) {
          html = rawHtml
          console.log(`[scrape] raw fetch kept structured-data markup (${rawHtml.length} chars)`)
        }
      }
    } catch (err) {
      console.log(`[scrape] raw fetch failed, falling back to Firecrawl html:`, err instanceof Error ? err.message : err)
    }

    // ── Tier 0: structured-data sniffers ───────────────────────────────────
    // Try __NEXT_DATA__, JSON-LD, Shopify etc. in order. When a sniffer
    // succeeds we use its variant matrix verbatim and skip the brittle
    // swatch-regex path. Claude is still consulted for editorial fields
    // (description, specs, category_slug).
    const sniffed = runSniffers(html, url)
    if (sniffed) {
      const withAttrs = sniffed.variants.filter((v) => v.attributes && Object.keys(v.attributes).length > 0).length
      const withImages = sniffed.variants.filter((v) => v.image_url).length
      console.log(
        `[scrape] sniffer "${sniffed.sniffer}" matched: ${sniffed.variants.length} variants ` +
        `(${withAttrs} w/ attributes, ${withImages} w/ images), ${sniffed.photos.length} photos`,
      )
      if (sniffed.variants[0]) {
        console.log(`[scrape] first variant sample:`, JSON.stringify(sniffed.variants[0]))
      }
    } else {
      console.log(`[scrape] no sniffer matched (html length: ${html.length}, has __NEXT_DATA__: ${/__NEXT_DATA__/.test(html)})`)
    }

    // Legacy: swatch regexes only run when no sniffer matched
    const colorImageUrls: { color: string; url: string }[] = []
    if (!sniffed) {
      // Pattern 1: color-describing attribute near a background-image or src
      const swatchRegex = /(?:data-(?:color|finish|variant|option)|aria-label|title)=["']([^"']{2,30})["'][^>]*(?:background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)|src=["']([^"']+)["'])/gi
      let swatchMatch
      while ((swatchMatch = swatchRegex.exec(html)) !== null) {
        const color = swatchMatch[1]?.trim()
        const imgUrl = swatchMatch[2] || swatchMatch[3]
        if (color && imgUrl && !imgUrl.includes("data:")) {
          try {
            const abs = new URL(imgUrl, url.toString()).toString()
            colorImageUrls.push({ color, url: abs })
          } catch {}
        }
      }

      // Pattern 2: image first, then color-describing attribute
      const swatchRegex2 = /src=["']([^"']+)["'][^>]*(?:data-(?:color|finish|variant)|aria-label|title)=["']([^"']{2,30})["']/gi
      while ((swatchMatch = swatchRegex2.exec(html)) !== null) {
        const imgUrl = swatchMatch[1]?.trim()
        const color = swatchMatch[2]?.trim()
        if (color && imgUrl && !imgUrl.includes("data:")) {
          try {
            const abs = new URL(imgUrl, url.toString()).toString()
            if (!colorImageUrls.some((c) => c.color === color)) {
              colorImageUrls.push({ color, url: abs })
            }
          } catch {}
        }
      }

      // Pattern 3: image URLs with color names in the path
      // (e.g. color_picker/Product-matt-black-mobile.png)
      const colorPathRegex = /["']((?:https?:\/\/[^"']*|\/[^"']*?)(?:color[_-]?picker|variants?|finishes?|materials?)[^"']*\/([^"'/]+)\.(png|jpe?g|webp))["']/gi
      let colorPathMatch
      while ((colorPathMatch = colorPathRegex.exec(html)) !== null) {
        const fullUrl = colorPathMatch[1]
        const filename = colorPathMatch[2]
        const colorFromFile = filename
          .replace(/[-_]mobile$/i, "")
          .replace(/^.*?-(?=[a-z])/i, "")
          .replace(/[-_]/g, " ")
          .trim()
        if (colorFromFile.length > 1 && colorFromFile.length < 40) {
          try {
            const abs = new URL(fullUrl, url.toString()).toString()
            if (!colorImageUrls.some((c) => c.url === abs)) {
              colorImageUrls.push({ color: colorFromFile, url: abs })
            }
          } catch {}
        }
      }

      // Pattern 4: JSON-like structures pairing color names with image URLs
      const jsonColorRegex = /["'](?:name|color|finish|material)["']\s*[:=]\s*["']([^"']{2,30})["'][^}]{0,200}?["'](?:image|src|url|thumbnail|preview|swatch)["']\s*[:=]\s*["']([^"']+\.(?:png|jpe?g|webp)(?:\?[^"']*)?)["']/gi
      let jsonMatch
      while ((jsonMatch = jsonColorRegex.exec(html)) !== null) {
        const color = jsonMatch[1].trim()
        const imgUrl = jsonMatch[2]
        if (color && imgUrl && !imgUrl.includes("data:")) {
          try {
            const abs = new URL(imgUrl, url.toString()).toString()
            if (!colorImageUrls.some((c) => c.color.toLowerCase() === color.toLowerCase())) {
              colorImageUrls.push({ color, url: abs })
            }
          } catch {}
        }
      }

      // Pattern 4b: reverse order — image first, then color name
      const jsonColorRegex2 = /["'](?:image|src|url|thumbnail|preview|swatch)["']\s*[:=]\s*["']([^"']+\.(?:png|jpe?g|webp)(?:\?[^"']*)?)["'][^}]{0,200}?["'](?:name|color|finish|material)["']\s*[:=]\s*["']([^"']{2,30})["']/gi
      while ((jsonMatch = jsonColorRegex2.exec(html)) !== null) {
        const imgUrl = jsonMatch[1]
        const color = jsonMatch[2].trim()
        if (color && imgUrl && !imgUrl.includes("data:")) {
          try {
            const abs = new URL(imgUrl, url.toString()).toString()
            if (!colorImageUrls.some((c) => c.color.toLowerCase() === color.toLowerCase())) {
              colorImageUrls.push({ color, url: abs })
            }
          } catch {}
        }
      }

      console.log(`[scrape] Found ${colorImageUrls.length} color variant images from HTML patterns`)
    }

    // ── Claude: structured extraction ──────────────────────────────────────
    const message = await ctx.anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Extract product info from this brand product page for an editorial directory.

Brand: ${ctx.brandName}
URL: ${url.toString()}

Page content:
${pageText}

Return ONLY a JSON object:
{
  "name": "Product name (cleaned, no brand prefix unless part of the name)",
  "family": "Product family/collection name or null. E.g. for 'Più R alto v' the family is 'Più'. For 'Mito sospeso' the family is 'Mito'. Extract the shared series name that groups related products.",
  "description": "1-2 sentence editorial description in your own words. Max 280 characters. Don't copy verbatim.",
  "category_slug": "slug from the list below, or null if unclear",
  "specs": { "key": "value" },
  "variants": [{"color": "color name", "hex": "#hexcode or null"}, ...]
}

category_slug: pick the MOST SPECIFIC matching category from this list:
${ctx.categoryList}
If none match well, return null.

specs should capture ALL technical details from the page, including any specifications tab/section. Use lowercase snake_case keys. Group by:

"designer": designer name
"year": year designed or launched

Dimensions: "width", "height", "depth", "diameter", "length", "weight", "seat_height", "canopy_diameter", "suspension_length"

Specifications: "wattage", "power", "lumens", "luminous_flux", "voltage", "color_temperature", "cri", "energy_class", "ip_rating", "led"

Features: "control", "rotation", "mobility", "features", "light_modes", "dimmable", "smart_home", "adjustable", "mounting_types"

Materials: "frame", "fabric", "upholstery", "finish", "material", "suspension", "glass", "base"

Include ALL measurements for ALL available sizes. If there are multiple sizes (e.g. 40cm and 60cm), include specs for each like: "diameter_40": "ø 400 mm", "diameter_60": "ø 600 mm", "power_40": "40W", "power_60": "60W".

variants should list ALL options shown on the page. Each variant can have:
- "color": color or finish name (e.g. "Phantom", "Brushed Brass") — for finish/color options
- "hex": hex color code if visible or inferrable, otherwise null
- "material": material name (e.g. "Walnut", "Leather", "Marble") — for material options
- "size": size label (e.g. "40cm", "60cm", "2-seater") — for size/model options

IMPORTANT: Include ALL available sizes as separate size variants. If a product comes in 40cm and 60cm, include BOTH: {"size": "40cm"}, {"size": "60cm"}. List every color AND every size separately.

Only include variants that are explicitly listed on the page. If no variants are shown, return "variants": [].

If the page is not a product page, return: {"name": "", "description": null, "category_slug": null, "specs": null, "variants": []}`,
      }],
    })

    const text = message.content[0]?.type === "text" ? message.content[0].text : ""
    const claudeJson = text.match(/\{[\s\S]*\}/)
    if (!claudeJson) throw new Error("No JSON in Claude response")
    const parsed = JSON.parse(claudeJson[0])

    const productName = parsed.name || sniffed?.name || ""

    // Sniffer-driven path: use the structured variant matrix, skip the
    // swatch-merge + dedup logic entirely.
    // Extract unique model labels from any variants — used by scopeSpecs
    // to redistribute per-model specs into Option-2 scoped buckets.
    const collectModels = (vs: RawVariant[] | null | undefined): string[] => {
      if (!vs) return []
      const seen = new Set<string>()
      const out: string[] = []
      for (const v of vs) {
        const m = v.attributes?.model ?? v.attributes?.size ?? v.size
        if (typeof m === "string" && m.trim() && !seen.has(m)) {
          seen.add(m)
          out.push(m)
        }
      }
      return out
    }

    if (sniffed) {
      const inferred = await inferAxes(sniffed.variants, productName, ctx.anthropic)
      // Variant images shouldn't pollute the gallery — colour/model cells
      // already own those on the edit page. Strip any photo whose URL also
      // appears as a variant image_url, then merge sniffer gallery (first)
      // with Firecrawl's markdown-extracted photos (second) so brand
      // lifestyle/applied shots don't disappear on structured sites.
      const normalise = (u: string) => u.toLowerCase().replace(/\/+$/, "")
      const variantUrls = new Set(
        inferred.combinations
          .map((c) => c.image_url)
          .filter((u): u is string => !!u)
          .map(normalise),
      )
      // Collect all candidate URLs from both sources, then run through
      // dedupePhotos so resolution duplicates and logos/icons are stripped
      // in one pass rather than scattered across two loops.
      const allCandidates = [...sniffed.photos, ...photos]
        .filter((p) => !variantUrls.has(normalise(p)))
        .map((u) => ({ url: u }))
      const merged = dedupePhotos(allCandidates)

      const models = collectModels(inferred.combinations)
      return {
        name: productName,
        family: parsed.family ?? sniffed.family ?? null,
        description: parsed.description ?? sniffed.description ?? null,
        specs: scopeSpecs(parsed.specs ?? null, models),
        variants: inferred.combinations.length > 0 ? inferred.combinations : null,
        photos: merged,
        category_slug: parsed.category_slug ?? null,
      }
    }

    // Strip product-name words from the front of a variant label so "Mito
    // Phantom" collapses to "Phantom" before the hex lookup runs.
    const productWords = new Set(productName.toLowerCase().split(/\s+/).filter(Boolean))
    const cleanColor = (raw: string): string => {
      const words = raw.split(/[\s\-–—]+/)
      let start = 0
      while (start < words.length && productWords.has(words[start].toLowerCase())) start++
      const cleaned = words.slice(start).join(" ").trim()
      return cleaned.length > 0 ? cleaned : raw
    }

    let variants = (parsed.variants ?? []) as RawVariant[]

    // Clean Claude variant names and fill missing hex from the lookup
    for (const v of variants) {
      if (v.color) {
        v.color = cleanColor(v.color)
        if (!v.hex) v.hex = COLOR_HEX[v.color.toLowerCase()] ?? null
      }
    }

    // Merge HTML swatch images into Claude's variant list
    if (colorImageUrls.length > 0) {
      for (const swatch of colorImageUrls) {
        const cleanedSwatchName = cleanColor(swatch.color)
        const existing = variants.find(
          (v) => v.color && cleanColor(v.color).toLowerCase() === cleanedSwatchName.toLowerCase()
        )
        if (existing) {
          existing.image_url = existing.image_url || swatch.url
        } else {
          const alreadyExists = variants.some(
            (v) => v.color && v.color.toLowerCase() === cleanedSwatchName.toLowerCase()
          )
          if (!alreadyExists) {
            variants.push({
              color: cleanedSwatchName,
              hex: COLOR_HEX[cleanedSwatchName.toLowerCase()] ?? null,
              image_url: swatch.url,
            })
          }
        }
      }
    }

    // Dedup by cleaned color name; keep the richest fields across duplicates
    const deduped = new Map<string, RawVariant>()
    for (const v of variants) {
      if (!v.color) { deduped.set(Math.random().toString(), v); continue }
      const key = v.color.toLowerCase()
      const existing = deduped.get(key)
      if (existing) {
        existing.hex = existing.hex || v.hex
        existing.image_url = existing.image_url || v.image_url
      } else {
        deduped.set(key, { ...v })
      }
    }
    variants = [...deduped.values()]

    return {
      name: parsed.name ?? "",
      family: parsed.family ?? null,
      description: parsed.description ?? null,
      specs: scopeSpecs(parsed.specs ?? null, collectModels(variants)),
      variants: variants.length > 0 ? variants : null,
      photos,
      category_slug: parsed.category_slug ?? null,
    }
  } catch (err) {
    console.error("[scrape] generic scrape failed", url.toString(), err)
    return { error: "Could not extract product info." }
  }
}
