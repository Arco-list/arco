// Transforms the flat `{key: value, width_big_scale_one: "250", ...}`
// shape the scraper emits into the scoped Option-2 layout used in the DB:
//
//   {
//     _shared: { material: "PA" },
//     "Big Scale One": { width: "250" },
//     ...
//   }
//
// Two passes:
//
//   1. Redistribute: if a key has a suffix matching a slugified model
//      label, strip the suffix and put the value under that model.
//   2. Promote shared values: if every model carries the same value for
//      a given key, lift it out to `_shared`. Keeps the common case
//      ("all models share this material") readable.
//
// Any key that doesn't match a known model label stays in `_shared`,
// where it's always shown regardless of selected model.

import type { ScopedSpecs } from "./types"

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export function scopeSpecs(
  flat: Record<string, unknown> | null | undefined,
  modelLabels: string[],
): ScopedSpecs | null {
  if (!flat) return null
  const entries = Object.entries(flat)
  if (entries.length === 0) return null

  const modelSlugs = modelLabels.map((label) => ({ label, slug: slugify(label) }))
  const scoped: ScopedSpecs = { _shared: {} }
  for (const { label } of modelSlugs) scoped[label] = {}

  // Pass 1 — redistribute by suffix
  for (const [rawKey, value] of entries) {
    const key = rawKey.toLowerCase()
    let matched = false
    for (const { label, slug } of modelSlugs) {
      if (!slug) continue
      if (key.endsWith(`_${slug}`)) {
        const baseKey = key.slice(0, key.length - slug.length - 1)
        scoped[label][baseKey] = value
        matched = true
        break
      }
    }
    if (!matched) scoped._shared[rawKey] = value
  }

  // Pass 2 — promote keys where every model has the same value to _shared.
  // Only runs when there are at least 2 models (otherwise "shared" vs
  // "model" is meaningless) and every model has a value for the key.
  if (modelLabels.length >= 2) {
    const modelKeys = new Set<string>()
    for (const label of modelLabels) {
      for (const k of Object.keys(scoped[label])) modelKeys.add(k)
    }
    for (const k of modelKeys) {
      let shared: unknown = undefined
      let allMatch = true
      for (const label of modelLabels) {
        const v = scoped[label][k]
        if (v === undefined) { allMatch = false; break }
        if (shared === undefined) shared = v
        else if (JSON.stringify(shared) !== JSON.stringify(v)) { allMatch = false; break }
      }
      if (allMatch) {
        scoped._shared[k] = shared
        for (const label of modelLabels) delete scoped[label][k]
      }
    }
  }

  // Trim empty model buckets so the DB doesn't carry `"Big Scale One": {}`.
  for (const label of modelLabels) {
    if (Object.keys(scoped[label]).length === 0) delete scoped[label]
  }

  // Also trim _shared if empty (unlikely but possible).
  if (Object.keys(scoped._shared).length === 0) delete scoped._shared

  return Object.keys(scoped).length === 0 ? null : scoped
}
