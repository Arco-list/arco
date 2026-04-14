// Registry of tier-0 sniffers, run in order. First successful match wins
// — later steps add json-ld, shopify, and nuxt sniffers to this list.

import type { Sniffer, SniffResult } from "./types"
import { nextDataSniffer } from "./next-data"

const SNIFFERS: Sniffer[] = [
  nextDataSniffer,
]

export function runSniffers(html: string, url: URL): SniffResult | null {
  for (const s of SNIFFERS) {
    if (!s.detect(html)) continue
    try {
      const result = s.parse(html, url)
      if (result && result.variants.length >= 2) return result
    } catch (err) {
      console.warn(`[scrape] sniffer ${s.name} threw`, err)
    }
  }
  return null
}
