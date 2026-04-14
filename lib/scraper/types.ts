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

export interface ScrapedProduct {
  name: string
  family: string | null
  description: string | null
  specs: Record<string, unknown> | null
  variants: RawVariant[] | null
  photos: string[]
  category_slug: string | null
}
