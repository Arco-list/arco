// Mirror of lib/projects/sort.ts for the /professionals discover grid.
// All four sorts are applied server-side inside the `search_professionals`
// RPC — the client just passes the sort key so pagination stays stable
// across "Load more".

export type ProfessionalSort = "most_relevant" | "featured" | "popular" | "most_recent"

export const PROFESSIONAL_SORT_OPTIONS = [
  "most_relevant",
  "featured",
  "popular",
  "most_recent",
] as const satisfies readonly ProfessionalSort[]

export const DEFAULT_PROFESSIONAL_SORT: ProfessionalSort = "most_relevant"

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
