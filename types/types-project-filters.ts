/**
 * Maps a top-level project category name (as it appears in the taxonomy)
 * to its allowed sub-category names.
 *
 * The parent name is included in the array when the parent itself is selectable.
 *
 * @example
 * {
 *   "House":      ["House", "Villa", "Townhouse", "Farmhouse"],
 *   "Bed & Bath": ["Bathroom", "Bedroom"],
 *   "Kitchen":    ["Kitchen"],
 * }
 */
export type ProjectTypeFilterMap = {
  readonly [parentCategory: string]: readonly string[]
}

// ─── Space filter ──────────────────────────────────────────────────────────────

export { SPACE_SLUGS as PROJECT_SPACES, type SpaceSlug as ProjectSpaceKey } from "@/lib/spaces"

// ─── Filter UI types ──────────────────────────────────────────────────────────

/** A single selectable item resolved from the taxonomy, ready for the filter UI. */
export interface ProjectFilterItem {
  id: string
  name: string
  slug?: string
  parentId: string | null
  parentSlug?: string
  /** True when this item IS the parent category itself (not a child) */
  isParent: boolean
  /** True when this item should appear as a selectable option in the UI */
  isListable: boolean
}

/**
 * A grouped section of filter items sharing a parent taxonomy category.
 * Rendered as a collapsible section in the filter drawer / type dropdown.
 */
export interface ProjectFilterSection {
  id: string
  name: string
  slug?: string
  items: ProjectFilterItem[]
}
