// Normalizes products.variants JSONB into a shape UI components can render
// uniformly, regardless of whether the scraper emitted flat independent
// options (Occhio, current scraper) or full combinations (Moooi, Shopify).
//
// - Independent mode: rows expose a single axis field (color/material/size).
//   Axes are selected independently; picking a color does not restrict sizes.
// - Combination mode: every row carries an `attributes` map keyed by axis
//   name. Picking one axis narrows the valid values of the others.
//
// The boundary is data-driven: any variant row with an `attributes` key
// flips the whole product into combination mode.

import type { RawVariant } from "@/lib/scraper/types"

export type AxisName = string

export interface AxisValue {
  /** Canonical key used for equality checks (lowercase, trimmed). */
  value: string
  /** Display label (may include casing, spaces). */
  label: string
  hex?: string | null
  image_url?: string | null
}

export interface Axis {
  name: AxisName
  values: AxisValue[]
}

export interface Combination {
  attributes: Record<AxisName, string>
  image_url?: string | null
  hex?: string | null
  sku?: string | null
  price?: number | null
  slug?: string | null
  in_stock?: boolean | null
}

export interface NormalizedVariants {
  mode: "independent" | "combination"
  axes: Axis[]
  /** Populated only in combination mode; empty array otherwise. */
  combinations: Combination[]
}

const EMPTY: NormalizedVariants = { mode: "independent", axes: [], combinations: [] }

/**
 * Strip product-name words that tend to prefix variant labels
 * (e.g. "Mito Sospeso Phantom" → "Phantom"). Order-independent.
 */
function cleanLabel(label: string, productName: string): string {
  if (!label) return label
  const productWords = new Set(productName.toLowerCase().split(/\s+/).filter(Boolean))
  const parts = label.split(/[\s\-–—]+/)
  let start = 0
  while (start < parts.length && productWords.has(parts[start]?.toLowerCase() ?? "")) start++
  const cleaned = parts.slice(start).join(" ").trim()
  return cleaned.length > 0 ? cleaned : label
}

export function normalizeVariants(
  raw: RawVariant[] | null | undefined,
  productName: string,
): NormalizedVariants {
  if (!raw || raw.length === 0) return EMPTY

  const isCombination = raw.some((v) => v.attributes && Object.keys(v.attributes).length > 0)

  if (isCombination) {
    // Discover axes from the union of attribute keys, preserving first-seen order
    const axisOrder: AxisName[] = []
    const seenAxis = new Set<AxisName>()
    for (const v of raw) {
      for (const k of Object.keys(v.attributes ?? {})) {
        if (!seenAxis.has(k)) { seenAxis.add(k); axisOrder.push(k) }
      }
    }

    // Collect unique values per axis, preserving first-seen order
    const axes: Axis[] = axisOrder.map((name) => {
      const seen = new Map<string, AxisValue>()
      for (const v of raw) {
        const raw_label = v.attributes?.[name]
        if (!raw_label) continue
        const label = cleanLabel(raw_label, productName)
        const key = label.toLowerCase()
        if (!seen.has(key)) {
          seen.set(key, {
            value: key,
            label,
            hex: v.hex ?? null,
            image_url: v.image_url ?? null,
          })
        }
      }
      return { name, values: [...seen.values()] }
    })

    const combinations: Combination[] = raw.map((v) => {
      const attrs: Record<AxisName, string> = {}
      for (const [k, val] of Object.entries(v.attributes ?? {})) {
        attrs[k] = cleanLabel(val, productName).toLowerCase()
      }
      return {
        attributes: attrs,
        image_url: v.image_url ?? null,
        hex: v.hex ?? null,
        sku: v.sku ?? null,
        price: v.price ?? null,
        slug: v.slug ?? null,
        in_stock: v.in_stock ?? null,
      }
    })

    return { mode: "combination", axes, combinations }
  }

  // Independent mode: each row has at most one axis field set
  const AXIS_FIELDS: Array<keyof RawVariant & ("color" | "material" | "size")> = ["color", "material", "size"]
  const axes: Axis[] = []
  for (const axisName of AXIS_FIELDS) {
    const seen = new Map<string, AxisValue>()
    for (const v of raw) {
      const rawLabel = v[axisName] as string | undefined
      if (!rawLabel) continue
      const label = axisName === "color" ? cleanLabel(rawLabel, productName) : rawLabel
      const key = label.toLowerCase()
      const existing = seen.get(key)
      if (!existing) {
        seen.set(key, {
          value: key,
          label,
          hex: v.hex ?? null,
          image_url: v.image_url ?? null,
        })
      } else {
        // Merge: keep hex/image from whichever row has them
        seen.set(key, {
          ...existing,
          hex: existing.hex ?? v.hex ?? null,
          image_url: existing.image_url ?? v.image_url ?? null,
        })
      }
    }
    if (seen.size > 0) axes.push({ name: axisName, values: [...seen.values()] })
  }

  return { mode: "independent", axes, combinations: [] }
}

/**
 * In combination mode, find the combination that matches all specified axis
 * values. Returns null if no complete match exists (e.g. user has only
 * selected a subset of axes, or the chosen combination is not in the matrix).
 */
export function findCombination(
  n: NormalizedVariants,
  selection: Record<AxisName, string | null | undefined>,
): Combination | null {
  if (n.mode !== "combination") return null
  const keys = n.axes.map((a) => a.name)
  if (!keys.every((k) => selection[k])) return null
  return n.combinations.find((c) => keys.every((k) => c.attributes[k] === selection[k])) ?? null
}

/**
 * In combination mode, given a partial selection, return the set of axis
 * values that have at least one matching combination. Used to dim/disable
 * unavailable options in the UI.
 */
export function availableValues(
  n: NormalizedVariants,
  axisName: AxisName,
  selection: Record<AxisName, string | null | undefined>,
): Set<string> {
  if (n.mode !== "combination") {
    const axis = n.axes.find((a) => a.name === axisName)
    return new Set(axis?.values.map((v) => v.value) ?? [])
  }
  const others = n.axes.map((a) => a.name).filter((k) => k !== axisName)
  const available = new Set<string>()
  for (const c of n.combinations) {
    const matches = others.every((k) => !selection[k] || c.attributes[k] === selection[k])
    if (matches) available.add(c.attributes[axisName])
  }
  return available
}
