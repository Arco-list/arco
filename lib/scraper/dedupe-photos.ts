// Deduplicates a list of scraped photo URLs:
//
//  1. Filters out logos, icons, badges, social-share placeholders, and
//     images whose URL screams "not a product photo."
//  2. Groups remaining URLs by an identity key — strips resolution
//     suffixes, CDN thumbnail modifiers, query params, AND file
//     extensions so that `Foo.webp` and `Foo.jpg` collapse together.
//  3. Picks the highest-resolution URL from each group. We prefer
//     explicit width × height metadata, then the longest URL path
//     (heuristic for higher-res CDN profiles).
//  4. Drops images below a minimum area threshold when dimensions are
//     known (40 × 40 → icons, 1 × 1 → pixels).
//  5. Returns at most `limit` URLs, first-seen order preserved.

export interface PhotoCandidate {
  url: string
  width?: number | null
  height?: number | null
}

// ── Rejection ──────────────────────────────────────────────────────────
// Split into path-level rejects (substring match on the full URL) and
// filename-level rejects (match on the basename only, so terms like
// "surface" or "share" only block filenames, not directory names that
// happen to contain the word).

const REJECT_PATH_RE = new RegExp([
  // Brand / identity assets
  "logo", "icon", "favicon", "sprite", "brand-?mark", "wordmark", "trademark",
  // Social / sharing meta
  "og[_-]?image", "twitter[_-]?card", "apple-touch", "manifest",
  // Social media glyphs
  "facebook", "instagram", "linkedin", "pinterest", "tiktok", "youtube", "x-logo", "twitter",
  // Review / trust platforms
  "trustpilot", "google[_-]?review",
  // Payment providers
  "payment", "visa", "mastercard", "paypal", "ideal", "amex", "klarna", "stripe-badge",
  // Colour swatches
  "color[_-]?picker", "swatch",
  // File types that aren't photos
  "\\.svg(?:\\?|$)", "\\.ico(?:\\?|$)", "\\.gif(?:\\?|$)",
].join("|"), "i")

// Filename-only rejects — terms that are too broad to match against the
// whole path (e.g. "surface" would block `/products/surface-lamp/hero.jpg`
// if applied path-wide). Only the final path segment is tested.
const REJECT_FILENAME_RE = /badge|star|rating|review|arrow|chevron|caret|hamburger|menu|close|search/i

// Minimum area threshold: skip known-tiny images (icons, tracking pixels).
// Only applied when explicit width × height are provided.
const MIN_AREA = 80 * 80  // 6400px² — anything below is almost certainly not a product photo

// ── Identity grouping ──────────────────────────────────────────────────
// Segments injected by CDN resize pipelines that distinguish resolutions
// of the same source asset. Stripping them produces a stable identity.
const RESOLUTION_STRIP_RE = /image-thumb__\d+__[a-z0-9_]+(?:_(?:2x|3x))?(?:_(?:jpg|png|webp))?/gi
const SHOPIFY_SIZE_RE = /_(?:\d+x\d*|\d*x\d+|pico|icon|thumb|small|compact|medium|large|grande|master)(?=\.)/gi
const CLOUDINARY_RE = /\/(?:w_|h_|c_|g_|q_|f_|dpr_)[^/]+\//gi
const QUERY_RE = /\?.*$/
// Strip the file extension so `Foo.webp` and `Foo.jpg` collapse to the
// same identity. Intentionally only strips common image extensions.
const EXT_RE = /\.(jpe?g|png|webp|avif|tiff?)$/i

function identityKey(url: string): string {
  let key = url.toLowerCase()
  key = key.replace(QUERY_RE, "")
  key = key.replace(RESOLUTION_STRIP_RE, "THUMB")
  key = key.replace(SHOPIFY_SIZE_RE, "")
  key = key.replace(CLOUDINARY_RE, "/")
  key = key.replace(EXT_RE, "")
  key = key.replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "")
  return key
}

function area(c: PhotoCandidate): number {
  if (c.width && c.height) return c.width * c.height
  return 0
}

function basename(url: string): string {
  try {
    const path = new URL(url).pathname
    return path.split("/").filter(Boolean).pop() ?? ""
  } catch {
    return url.split("/").pop() ?? ""
  }
}

export function dedupePhotos(
  candidates: PhotoCandidate[],
  limit = 15,
): string[] {
  // Pass 1 — filter
  const accepted = candidates.filter((c) => {
    if (REJECT_PATH_RE.test(c.url)) return false
    if (REJECT_FILENAME_RE.test(basename(c.url))) return false
    // Drop known-tiny images when dimensions are available.
    const a = area(c)
    if (a > 0 && a < MIN_AREA) return false
    return true
  })

  // Pass 2 — group by identity
  const groups = new Map<string, PhotoCandidate[]>()
  // Track insertion order so the output follows first-seen sequence.
  const groupOrder: string[] = []
  for (const c of accepted) {
    const key = identityKey(c.url)
    if (!groups.has(key)) {
      groups.set(key, [])
      groupOrder.push(key)
    }
    groups.get(key)!.push(c)
  }

  // Pass 3 — pick the best URL per group
  const result: string[] = []
  const seenUrls = new Set<string>()
  for (const key of groupOrder) {
    const members = groups.get(key)!
    // Prefer explicit dimensions, then longest URL (heuristic for
    // higher-res CDN profile), then first-seen.
    members.sort((a, b) => {
      const da = area(a)
      const db = area(b)
      if (da !== db) return db - da
      return b.url.length - a.url.length
    })
    const best = members[0].url
    if (seenUrls.has(best)) continue
    seenUrls.add(best)
    result.push(best)
    if (result.length >= limit) break
  }

  return result
}
