// Shared project-sort semantics. Consumed by both the server-side
// discover query (lib/projects/queries.ts) and the client-side pagination
// hook (hooks/use-projects-query.ts) so the ORDER BY is applied in the
// database and every "Load more" page continues the same sorted sequence.

export type ProjectSort = "most_relevant" | "featured" | "popular" | "most_recent"

export const PROJECT_SORT_OPTIONS = [
  "most_relevant",
  "featured",
  "popular",
  "most_recent",
] as const satisfies readonly ProjectSort[]

export const DEFAULT_PROJECT_SORT: ProjectSort = "most_relevant"

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
      return [
        { column: "is_featured", ascending: false },
        { column: "credited_count", ascending: false },
        { column: "created_at", ascending: false },
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
