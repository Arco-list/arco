// Sniffer for Next.js sites that embed server state in
// <script id="__NEXT_DATA__" type="application/json">. Works for any
// brand on a Next.js stack (Moooi, many Centra/Shopify-on-Next merchants)
// because we don't assume a specific path into the JSON tree — we walk
// the blob heuristically to find variant arrays and product metadata.

import type { Sniffer, SniffedVariant, SniffResult } from "./types"
import { dedupePhotos, type PhotoCandidate } from "../dedupe-photos"

const NEXT_DATA_RE = /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i

// Keys that typically hold a product's display name
const NAME_KEYS = ["heading", "fullHeading", "name", "title", "productName"]
// Keys that typically hold a family/collection name
const FAMILY_KEYS = ["productFamily", "family", "collection", "series"]
// Keys that typically hold a description
const DESCRIPTION_KEYS = ["description", "longDescription", "summary"]
// Array keys that commonly hold variant matrices
const VARIANT_ARRAY_KEYS = ["productVariations", "variations", "variants", "skus", "productVariants"]
// Array keys that commonly hold shared product photos
const GALLERY_KEYS = ["galleryImages", "images", "photos", "productImages", "media"]

// Fields inside a variant object that reveal it's a variant
const VARIANT_NAME_KEYS = ["variantName", "name", "title", "label"]
const VARIANT_IMAGE_KEYS = ["thumbnailImage", "image", "featured_image", "heroImage", "src"]
const VARIANT_PRICE_KEYS = ["priceAsNumber", "price"]
const VARIANT_SKU_KEYS = ["sku", "centraVariant", "ean", "gtin"]
const VARIANT_SLUG_KEYS = ["slug", "handle", "url"]
const VARIANT_STOCK_KEYS = ["isInStock", "inStock", "available", "availability"]

function getString(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k]
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "object" && v && typeof v.name === "string") return v.name.trim()
  }
  return null
}

function getNumber(obj: any, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj?.[k]
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string") {
      const parsed = parseFloat(v.replace(/[^\d.]/g, ""))
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function getBoolean(obj: any, keys: string[]): boolean | null {
  for (const k of keys) {
    const v = obj?.[k]
    if (typeof v === "boolean") return v
  }
  return null
}

function extractImageSrc(val: any): string | null {
  if (!val) return null
  if (typeof val === "string") return val
  if (typeof val === "object") {
    if (typeof val.src === "string") return val.src
    if (typeof val.url === "string") return val.url
  }
  return null
}

function getImage(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    const src = extractImageSrc(obj?.[k])
    if (src) return src
  }
  return null
}

/** True if the object looks like a variant row (has name + image + identifier). */
function looksLikeVariant(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false
  const hasName = getString(obj, VARIANT_NAME_KEYS) !== null
  const hasImage = getImage(obj, VARIANT_IMAGE_KEYS) !== null
  const hasId = getString(obj, VARIANT_SKU_KEYS) !== null
    || getString(obj, VARIANT_SLUG_KEYS) !== null
    || getNumber(obj, VARIANT_PRICE_KEYS) !== null
  return hasName && (hasImage || hasId)
}

/** Walk the JSON tree looking for array-of-variants. Returns the largest
 *  well-shaped candidate. Prefers arrays found under VARIANT_ARRAY_KEYS. */
function findVariantArray(root: any): any[] | null {
  let bestPreferred: any[] | null = null
  let bestGeneric: any[] | null = null

  const visit = (node: any, parentKey: string | null) => {
    if (!node || typeof node !== "object") return
    if (Array.isArray(node)) {
      if (node.length >= 2) {
        const variantLike = node.filter(looksLikeVariant)
        // Require at least half the array to look like variants to avoid
        // matching unrelated arrays (e.g. nav menu items).
        if (variantLike.length >= 2 && variantLike.length / node.length >= 0.5) {
          const isPreferred = parentKey && VARIANT_ARRAY_KEYS.includes(parentKey)
          if (isPreferred) {
            if (!bestPreferred || variantLike.length > bestPreferred.length) {
              bestPreferred = variantLike
            }
          } else {
            if (!bestGeneric || variantLike.length > bestGeneric.length) {
              bestGeneric = variantLike
            }
          }
        }
      }
      for (const item of node) visit(item, parentKey)
      return
    }
    for (const [k, v] of Object.entries(node)) visit(v, k)
  }
  visit(root, null)

  return bestPreferred ?? bestGeneric
}

/** Walk the tree looking for a product-shaped object (name + description or
 *  name + gallery). Returns the richest match. */
function findProductNode(root: any): Record<string, any> | null {
  let best: Record<string, any> | null = null
  let bestScore = 0

  const visit = (node: any) => {
    if (!node || typeof node !== "object") return
    if (!Array.isArray(node)) {
      const hasName = getString(node, NAME_KEYS) !== null
      const hasDesc = getString(node, DESCRIPTION_KEYS) !== null
      const hasGallery = GALLERY_KEYS.some((k) => Array.isArray(node[k]))
      const hasVariants = VARIANT_ARRAY_KEYS.some((k) => Array.isArray(node[k]))
      const score = (hasName ? 1 : 0) + (hasDesc ? 1 : 0) + (hasGallery ? 1 : 0) + (hasVariants ? 2 : 0)
      if (hasName && score > bestScore) { best = node; bestScore = score }
    }
    for (const v of Object.values(Array.isArray(node) ? node : node)) visit(v)
  }
  visit(root)
  return best
}

function extractGallery(product: any, baseUrl: URL): string[] {
  const candidates: PhotoCandidate[] = []
  const seen = new Set<string>()
  for (const k of GALLERY_KEYS) {
    const arr = product?.[k]
    if (!Array.isArray(arr)) continue
    for (const item of arr) {
      const src = extractImageSrc(item)
      if (!src) continue
      try {
        const abs = new URL(src, baseUrl).toString()
        if (seen.has(abs)) continue
        seen.add(abs)
        const width = typeof item?.width === "number" ? item.width : null
        const height = typeof item?.height === "number" ? item.height : null
        candidates.push({ url: abs, width, height })
      } catch {}
    }
    if (candidates.length > 0) break
  }
  return dedupePhotos(candidates, 20)
}

function toSniffedVariant(obj: any, baseUrl: URL): SniffedVariant | null {
  const name = getString(obj, VARIANT_NAME_KEYS)
  if (!name) return null

  const rawImg = getImage(obj, VARIANT_IMAGE_KEYS)
  let image_url: string | null = null
  if (rawImg) {
    try { image_url = new URL(rawImg, baseUrl).toString() } catch {}
  }

  // Moooi (and most Next.js commerce sites) embed a pre-structured
  // { model, color, finish, ... } object on each variant. Carrying this
  // through means the downstream axis-inferrer can skip the name-splitting
  // heuristic entirely and produce a clean combination matrix. We only
  // keep short string values — colorCode/dimensions are dropped since they
  // aren't axis values, but the hex is preserved separately below.
  let attributes: Record<string, string> | null = null
  let hex: string | null = null
  if (obj?.attributes && typeof obj.attributes === "object") {
    const rawAttrs = obj.attributes as Record<string, unknown>
    const keep: Record<string, string> = {}
    for (const [k, v] of Object.entries(rawAttrs)) {
      if (typeof v !== "string" || !v.trim()) continue
      // Skip scalar descriptors that aren't axes
      if (/^(colorCode|colorImage|dimension|hex)/i.test(k)) continue
      if (k === "colorFilterNames") continue
      keep[k] = v.trim()
    }
    if (Object.keys(keep).length > 0) attributes = keep
    const code = rawAttrs.colorCode
    if (typeof code === "string" && /^#?[0-9a-f]{3,8}$/i.test(code.trim())) {
      hex = code.trim().startsWith("#") ? code.trim() : `#${code.trim()}`
    }
  }

  return {
    name,
    image_url,
    sku: getString(obj, VARIANT_SKU_KEYS),
    price: getNumber(obj, VARIANT_PRICE_KEYS),
    slug: getString(obj, VARIANT_SLUG_KEYS),
    in_stock: getBoolean(obj, VARIANT_STOCK_KEYS),
    attributes,
    hex,
  }
}

export const nextDataSniffer: Sniffer = {
  name: "next-data",

  detect(html: string): boolean {
    return /id=["']__NEXT_DATA__["']/.test(html)
  },

  parse(html: string, url: URL): SniffResult | null {
    const match = html.match(NEXT_DATA_RE)
    if (!match?.[1]) return null

    let data: any
    try { data = JSON.parse(match[1]) } catch { return null }

    const variantArr = findVariantArray(data)
    if (!variantArr || variantArr.length < 2) return null

    const variants = variantArr
      .map((v) => toSniffedVariant(v, url))
      .filter((v): v is SniffedVariant => v !== null)

    if (variants.length < 2) return null

    const product = findProductNode(data)
    const photos = product ? extractGallery(product, url) : []

    return {
      sniffer: "next-data",
      variants,
      photos,
      name: product ? getString(product, NAME_KEYS) : null,
      family: product ? getString(product, FAMILY_KEYS) : null,
      description: product ? getString(product, DESCRIPTION_KEYS) : null,
    }
  },
}
