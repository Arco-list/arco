// Groups a flat `specs` object into Dimensions / Materials / Features /
// Other. Used on both the public product detail page and the admin
// product edit page so the two stay visually aligned.
//
// Pre-defined spec keys live in KNOWN_SPECS — the admin autocomplete
// draws from this list, and any user-typed key that fuzzy-matches a
// known key gets auto-filled. Custom keys are allowed and land in Other.

export type SpecGroup = { label: string; entries: [string, unknown][] }

// ── Pre-defined spec keys ─────────────────────────────────────────────
// Each entry: { key (snake_case DB identifier), label (display name),
// group }. The key is what gets stored in specs JSONB; the label is
// what the user sees in the autocomplete + spec row.

export interface KnownSpec {
  key: string
  label: string
  group: "Dimensions" | "Materials" | "Features"
}

export const KNOWN_SPECS: KnownSpec[] = [
  // Dimensions
  { key: "width", label: "Width", group: "Dimensions" },
  { key: "height", label: "Height", group: "Dimensions" },
  { key: "depth", label: "Depth", group: "Dimensions" },
  { key: "diameter", label: "Diameter", group: "Dimensions" },
  { key: "length", label: "Length", group: "Dimensions" },
  { key: "weight", label: "Weight", group: "Dimensions" },
  { key: "seat_height", label: "Seat height", group: "Dimensions" },
  { key: "suspension_length", label: "Suspension length", group: "Dimensions" },
  { key: "canopy", label: "Canopy", group: "Dimensions" },

  // Materials
  { key: "material", label: "Material", group: "Materials" },
  { key: "frame", label: "Frame", group: "Materials" },
  { key: "base", label: "Base", group: "Materials" },
  { key: "fabric", label: "Fabric", group: "Materials" },
  { key: "upholstery", label: "Upholstery", group: "Materials" },
  { key: "glass", label: "Glass", group: "Materials" },
  { key: "finish", label: "Finish", group: "Materials" },
  { key: "finish_process", label: "Finish process", group: "Materials" },
  { key: "suspension", label: "Suspension", group: "Materials" },

  // Features
  { key: "power", label: "Power", group: "Features" },
  { key: "energy_class", label: "Energy efficiency", group: "Features" },
  { key: "wattage", label: "Wattage", group: "Features" },
  { key: "voltage", label: "Voltage", group: "Features" },
  { key: "lumens", label: "Lumens", group: "Features" },
  { key: "luminous_flux", label: "Luminous flux", group: "Features" },
  { key: "color_temperature", label: "Color temperature", group: "Features" },
  { key: "cri", label: "CRI", group: "Features" },
  { key: "ip_rating", label: "IP rating", group: "Features" },
  { key: "led", label: "LED", group: "Features" },
  { key: "light_direction", label: "Light direction", group: "Features" },
  { key: "dimmable", label: "Dimmable", group: "Features" },
  { key: "smart_home", label: "Smart home", group: "Features" },
  { key: "adjustable", label: "Adjustable", group: "Features" },
  { key: "control", label: "Control", group: "Features" },
  { key: "mounting", label: "Mounting", group: "Features" },
  { key: "rotation", label: "Rotation", group: "Features" },
  { key: "light_modes", label: "Light modes", group: "Features" },
  { key: "flow_rate", label: "Flow rate", group: "Features" },
  { key: "capacity", label: "Capacity", group: "Features" },
]

// Fast lookup maps
const KNOWN_BY_KEY = new Map(KNOWN_SPECS.map((s) => [s.key, s]))
const KNOWN_BY_LABEL_LOWER = new Map(KNOWN_SPECS.map((s) => [s.label.toLowerCase(), s]))

// Group names in render order — "Other" is always last.
const GROUP_ORDER: readonly string[] = ["Dimensions", "Materials", "Features"]

export function specGroup(key: string): string {
  return KNOWN_BY_KEY.get(key)?.group ?? "Other"
}

export function specLabel(key: string): string {
  return KNOWN_BY_KEY.get(key)?.label ?? key.replace(/_/g, " ")
}

/** Fuzzy-match a user-typed string against known spec labels + keys.
 *  Returns matches sorted by relevance (prefix > contains). */
export function matchKnownSpecs(input: string): KnownSpec[] {
  if (!input.trim()) return KNOWN_SPECS
  const lower = input.toLowerCase().replace(/[_\s]+/g, " ").trim()
  const exact = KNOWN_BY_LABEL_LOWER.get(lower) ?? KNOWN_BY_KEY.get(lower.replace(/\s+/g, "_"))
  if (exact) return [exact]
  const prefixMatches: KnownSpec[] = []
  const containsMatches: KnownSpec[] = []
  for (const s of KNOWN_SPECS) {
    const labelLower = s.label.toLowerCase()
    const keyLower = s.key
    if (labelLower.startsWith(lower) || keyLower.startsWith(lower.replace(/\s+/g, "_"))) {
      prefixMatches.push(s)
    } else if (labelLower.includes(lower) || keyLower.includes(lower.replace(/\s+/g, "_"))) {
      containsMatches.push(s)
    }
  }
  return [...prefixMatches, ...containsMatches]
}

// Keys shown in the details bar above specs — skip them here to avoid
// showing the same field twice on the public page.
const BAR_KEYS = new Set(["designer", "year"])

function matchesGroup(key: string, groupKeys: readonly string[]): boolean {
  const lower = key.toLowerCase()
  return groupKeys.some((gk) => lower === gk || lower.startsWith(gk + "_"))
}

export function groupSpecs(
  specs: Record<string, unknown> | null | undefined,
  {
    includeBarKeys = false,
    specOrder,
    specGroupOverrides,
  }: {
    includeBarKeys?: boolean
    specOrder?: string[] | null
    specGroupOverrides?: Record<string, string> | null
  } = {},
): SpecGroup[] {
  if (!specs) return []
  const entries = Object.entries(specs).filter(
    ([k]) => includeBarKeys || !BAR_KEYS.has(k.toLowerCase()),
  )

  // Sort entries by explicit order when provided. Keys not in
  // spec_order sink to the bottom in their original insertion order.
  if (specOrder && specOrder.length > 0) {
    const orderMap = new Map(specOrder.map((k, i) => [k, i]))
    const maxIdx = specOrder.length
    entries.sort((a, b) => (orderMap.get(a[0]) ?? maxIdx) - (orderMap.get(b[0]) ?? maxIdx))
  }

  const resolveGroup = (key: string): string => {
    if (specGroupOverrides && key in specGroupOverrides) return specGroupOverrides[key]
    return specGroup(key)
  }

  const buckets = new Map<string, [string, unknown][]>()
  // Track group order by first occurrence (respects spec_order).
  const groupOrder: string[] = []

  for (const [key, value] of entries) {
    const group = resolveGroup(key)
    if (!buckets.has(group)) {
      buckets.set(group, [])
      groupOrder.push(group)
    }
    buckets.get(group)!.push([key, value])
  }

  // When there's no explicit order, use the canonical group sequence.
  const renderOrder = specOrder && specOrder.length > 0
    ? groupOrder
    : [...GROUP_ORDER, ...groupOrder.filter((g) => !GROUP_ORDER.includes(g) && g !== "Other")]

  const grouped: SpecGroup[] = []
  for (const g of renderOrder) {
    const b = buckets.get(g)
    if (b && b.length > 0) grouped.push({ label: g, entries: b })
  }
  const other = buckets.get("Other")
  if (other && other.length > 0 && !grouped.some((g) => g.label === "Other")) {
    grouped.push({ label: "Other", entries: other })
  }

  return grouped
}

// Grouped options for the admin "Add spec" dropdown / autocomplete.
export const SPEC_KEY_OPTIONS = GROUP_ORDER.map((g) => ({
  label: g,
  keys: KNOWN_SPECS.filter((s) => s.group === g).map((s) => s.key),
}))
