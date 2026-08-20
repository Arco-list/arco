// Seeded ordering for the "Uitgelicht" (default) project feed.
//
// The featured sort is: 1) starred tier first, 2) constant scope variation —
// within each band the feed round-robins across scopes (new build /
// interior design / renovation), with BOTH the scope order per round and
// the project order within each scope shuffled from a seed. A fresh seed
// per page load means the listing reorders on every reload, while the same
// seed keeps "Load more" pagination stable within that visit.
//
// Deliberately no credits/recency weighting here: position inside the band
// is pure rotation, so every project gets time above the fold.
//
// Used by BOTH the SSR discover query (lib/projects/queries.ts, seed per
// request) and the client pagination hook (hooks/use-projects-query.ts,
// seed per mount). The DB-level "featured" ORDER BY in lib/projects/sort.ts
// remains only as a deterministic fallback.

interface FeedRow {
  id: string | null
  is_featured: boolean | null
  project_type: string | null
}

/** Deterministic PRNG — same seed, same sequence, across server and client. */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(arr: readonly T[], rand: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Order feed rows into an id list: featured band first, each band
 * scope-rotated and shuffled from `seed` (any number, e.g. Math.random()).
 */
export function orderFeaturedFeed(rows: readonly FeedRow[], seed: number): string[] {
  const rand = mulberry32(Math.floor(seed * 0x7fffffff) || 1)

  const orderBand = (band: FeedRow[]): string[] => {
    const byScope = new Map<string, string[]>()
    for (const row of band) {
      if (!row.id) continue
      const scope = row.project_type ?? "other"
      const list = byScope.get(scope) ?? []
      list.push(row.id)
      byScope.set(scope, list)
    }
    for (const [scope, ids] of byScope) byScope.set(scope, shuffled(ids, rand))

    const out: string[] = []
    while (byScope.size > 0) {
      // One round: a project from every scope, scope order reshuffled per round.
      for (const scope of shuffled([...byScope.keys()], rand)) {
        const list = byScope.get(scope)!
        const next = list.shift()
        if (next) out.push(next)
        if (list.length === 0) byScope.delete(scope)
      }
    }
    return out
  }

  const featured: FeedRow[] = []
  const rest: FeedRow[] = []
  for (const row of rows) (row.is_featured ? featured : rest).push(row)

  return [...orderBand(featured), ...orderBand(rest)]
}
