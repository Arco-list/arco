/**
 * Hetzelfde product op meerdere foto's van een project (de Moon-lamp op vier
 * foto's): stippen groeperen, zodat een admin het product één keer beoordeelt.
 *
 * Twee stippen horen bij elkaar als ze van dezelfde soort zijn en
 *   - hun uitsneden sterk op elkaar lijken (Voyage, cosine ≥ 0,85; gemeten
 *     op de penthouse: hetzelfde product 0,86–0,96, verschillende producten
 *     van dezelfde soort ≤ 0,76), of
 *   - ze hetzelfde voorstel of dezelfde goedkeuring hebben.
 * Twee al beoordeelde stippen horen alleen bij elkaar als hun oordeel gelijk
 * is: een groep voegt nooit tegenstrijdige oordelen samen tot één.
 * Groepen zijn transitief (A~B en B~C → één groep).
 *
 * Zelf gekoppeld (same_product_key, migratie 345) gaat altijd voor: stippen
 * met dezelfde sleutel horen bij elkaar, ongeacht soort, gelijkenis of oordeel.
 */

export const SAME_PRODUCT_SIMILARITY = 0.85
/** Vanaf hier als "misschien hetzelfde" voorstellen in de kaart; zelf bevestigen. */
export const MAYBE_SAME_SIMILARITY = 0.6

export type GroupInput = {
  id: string
  /** Soort (category_id of kind_slug); null bij een zelf toegevoegde stip. */
  kind: string | null
  reviewed: boolean
  /** Waar hij aan gekoppeld is of wordt: goedgekeurd, anders het voorstel ("collection:<id>", …). */
  target: string | null
  /** Het oordeel als het beoordeeld is ("approved:collection:<id>", "rejected", "hidden", …). */
  outcome: string | null
  vector: Float32Array | null
  /** Zelf gekoppeld als hetzelfde product. */
  key?: string | null
}

export const cosine =(a: Float32Array, b: Float32Array) => {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

/** Per stip het id van zijn groep (het kleinste id in de groep). */
export function groupDetections(items: GroupInput[]): Map<string, string> {
  const parent = new Map(items.map((x) => [x.id, x.id]))
  const find = (id: string): string => {
    let r = id
    while (parent.get(r) !== r) r = parent.get(r)!
    parent.set(id, r)
    return r
  }
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b)
    if (ra === rb) return
    if (ra < rb) parent.set(rb, ra)
    else parent.set(ra, rb)
  }
  const firstWithKey = new Map<string, string>()
  for (const x of items) {
    if (!x.key) continue
    const first = firstWithKey.get(x.key)
    if (first) union(first, x.id)
    else firstWithKey.set(x.key, x.id)
  }
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j]
      if (a.kind && b.kind && a.kind !== b.kind) continue
      const sameTarget = Boolean(a.target && a.target === b.target)
      const similar = Boolean(a.vector && b.vector && a.kind && b.kind && cosine(a.vector, b.vector) >= SAME_PRODUCT_SIMILARITY)
      if (a.reviewed && b.reviewed) {
        if (a.outcome === b.outcome && (sameTarget || similar)) union(a.id, b.id)
      } else if (sameTarget || similar) {
        union(a.id, b.id)
      }
    }
  }
  return new Map(items.map((x) => [x.id, find(x.id)]))
}

export const parseVector = (v: unknown): Float32Array | null => {
  if (!v) return null
  try {
    const arr = typeof v === "string" ? (JSON.parse(v) as number[]) : (v as number[])
    return Array.isArray(arr) && arr.length ? Float32Array.from(arr) : null
  } catch {
    return null
  }
}
