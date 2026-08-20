// Shared project-sort semantics. Consumed by both the server-side
// discover query (lib/projects/queries.ts) and the client-side pagination
// hook (hooks/use-projects-query.ts) so the ORDER BY is applied in the
// database and every "Load more" page continues the same sorted sequence.

export type ProjectSort = "most_relevant" | "featured" | "popular" | "most_recent"

// Featured leads and is the DEFAULT: the curated tier (AI featured
// decision at import, admin-overridable star) sits above the fold on
// discover, hubs and home. "Most relevant" is the pure network signal
// (credits) for visitors who opt out of curation.
export const PROJECT_SORT_OPTIONS = [
  "featured",
  "most_relevant",
  "popular",
  "most_recent",
] as const satisfies readonly ProjectSort[]

export const DEFAULT_PROJECT_SORT: ProjectSort = "featured"

/** Translation keys in the `projects` namespace. */
export const PROJECT_SORT_I18N_KEYS: Record<ProjectSort, string> = {
  most_relevant: "sort_most_relevant",
  featured: "sort_featured",
  popular: "sort_most_popular",
  most_recent: "sort_most_recent",
}

interface SortClause {
  column: string
  ascending: boolean
}

function clausesFor(sort: ProjectSort): SortClause[] {
  switch (sort) {
    case "most_relevant":
      return [
        { column: "credited_count", ascending: false },
        { column: "created_at", ascending: false },
      ]
    case "featured":
      // The real featured feed is a seeded per-reload shuffle (starred
      // band first, then constant scope rotation) computed in
      // lib/projects/featured-shuffle.ts by both the SSR query and the
      // client hook. These DB clauses are only the deterministic fallback
      // for any other consumer of applyProjectSort.
      return [
        { column: "is_featured", ascending: false },
        { column: "scope_rotation", ascending: true },
        { column: "views_count", ascending: false },
      ]
    case "popular":
      return [
        { column: "views_count", ascending: false },
        { column: "created_at", ascending: false },
      ]
    case "most_recent":
      return [{ column: "created_at", ascending: false }]
  }
}

/**
 * Apply the ORDER BY clauses for `sort` to a Supabase query builder.
 * Returns the same builder so calls can chain.
 */
export function applyProjectSort<T>(query: T, sort: ProjectSort): T {
  let q: any = query
  for (const clause of clausesFor(sort)) {
    q = q.order(clause.column, { ascending: clause.ascending, nullsFirst: false })
  }
  return q as T
}

export function isValidProjectSort(value: unknown): value is ProjectSort {
  return typeof value === "string" && (PROJECT_SORT_OPTIONS as readonly string[]).includes(value)
}
