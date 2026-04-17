// Shape produced by a sniffer — a tier-0 fast path that recognizes a
// specific embedded-data format (Next.js __NEXT_DATA__, JSON-LD, Shopify
// /products.js, etc.). Sniffers extract the variant matrix directly and
// short-circuit the LLM-driven fallback for brands whose sites expose
// structured product data.
//
// `attributes` is populated when the source pre-structures axes (Shopify
// option1/2/3). For sources that only give a single `name` string
// ("Round 250, Rosetta Dawn"), the axis-inference step splits the name
// into attributes downstream.

export interface SniffedVariant {
  name: string
  image_url?: string | null
  sku?: string | null
  price?: number | null
  slug?: string | null
  in_stock?: boolean | null
  attributes?: Record<string, string> | null
  /** Brand-provided hex swatch (Moooi's colorCode). Preserved separately
   *  from `attributes` so the downstream mapper can stamp it on the color. */
  hex?: string | null
}

export interface SniffResult {
  variants: SniffedVariant[]
  photos: string[]
  name?: string | null
  family?: string | null
  description?: string | null
  /** Identifier of the sniffer that produced this result — for logging. */
  sniffer: string
}

export interface Sniffer {
  name: string
  detect(html: string): boolean
  parse(html: string, url: URL): SniffResult | null
}
