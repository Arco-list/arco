// Mirror of lib/projects/sort.ts for the /professionals discover grid.
// Sorts are applied server-side inside the `search_professionals` RPC —
// except the featured (default) feed, which is a seeded per-reload
// rotation computed via orderCardsForFeaturedFeed below.

import { orderFeaturedFeed } from "@/lib/projects/featured-shuffle"
import type { ProfessionalCard } from "./types"

export type ProfessionalSort = "most_relevant" | "featured" | "popular" | "most_recent"

// Featured leads and is the DEFAULT — mirrors lib/projects/sort.ts: the
// curated tier sits above the fold, "most relevant" is the pure credits
// signal for visitors who opt out of curation.
export const PROFESSIONAL_SORT_OPTIONS = [
  "featured",
  "most_relevant",
  "popular",
  "most_recent",
] as const satisfies readonly ProfessionalSort[]

export const DEFAULT_PROFESSIONAL_SORT: ProfessionalSort = "featured"

/** Translation keys in the `professionals` namespace. */
export const PROFESSIONAL_SORT_I18N_KEYS: Record<ProfessionalSort, string> = {
  most_relevant: "sort_most_relevant",
  featured: "sort_featured",
  popular: "sort_most_popular",
  most_recent: "sort_most_recent",
}

export function isValidProfessionalSort(value: unknown): value is ProfessionalSort {
  return typeof value === "string" && (PROFESSIONAL_SORT_OPTIONS as readonly string[]).includes(value)
}

/**
 * Featured-feed ordering for company cards: starred band first, then the
 * profession types interleaved (architects / interior designers / ...) with
 * both the type order per round and the company order within each type
 * shuffled from `seed` — the professionals' twin of the projects feed
 * (profession plays the role that scope plays for projects).
 */
export function orderCardsForFeaturedFeed(cards: ProfessionalCard[], seed: number): ProfessionalCard[] {
  const orderedIds = orderFeaturedFeed(
    cards.map((c) => ({
      id: c.companyId,
      is_featured: c.isFeatured ?? false,
      project_type: c.profession ?? "other",
    })),
    seed,
  )
  const index = new Map(orderedIds.map((id, i) => [id, i]))
  return cards.slice().sort((a, b) => (index.get(a.companyId) ?? 0) - (index.get(b.companyId) ?? 0))
}
