// Shared types for the product scraping pipeline.
//
// Phase 1 emits flat variants ({color}, {size}, {material}) — one object
// per independent axis value. Phase 2 introduces the combination shape
// ({attributes: {axis1, axis2, ...}}) for sites that expose a full variant
// matrix (Moooi, Shopify, etc.). Both shapes coexist in the JSONB column;
// the consumer-side normalizer converts flat → combination on read.

export interface RawVariant {
  // Flat shape
  color?: string
  hex?: string | null
  material?: string
  size?: string
  image_url?: string | null

  // Combination shape
  attributes?: Record<string, string>
  sku?: string
  price?: number
  slug?: string
  in_stock?: boolean
}

// Scoped specs layout ("Option 2"). `_shared` holds specs that apply to
// the whole product; any other key is a model label carrying specs
// specific to that model. Flat specs (legacy products scraped before
// this change) land untouched in `_shared`.
export type ScopedSpecs = Record<string, Record<string, unknown>>

export interface ScrapedProduct {
  name: string
  family: string | null
  description: string | null
  specs: ScopedSpecs | null
  variants: RawVariant[] | null
  photos: string[]
  category_slug: string | null
}
