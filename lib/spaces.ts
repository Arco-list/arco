/**
 * Canonical list of spaces (rooms/zones) for tagging project photos.
 * Single source of truth — used by photo tour, discover filters, and API auto-tagging.
 */

export const SPACE_SLUGS = [
  "exterior",
  "living",
  "kitchen",
  "bedroom",
  "bathroom",
  "home-office",
  "hallway",
  "garden",
  "pool",
  "terrace",
  "other",
] as const

export type SpaceSlug = (typeof SPACE_SLUGS)[number]

export interface Space {
  slug: SpaceSlug
  name: string
  iconKey: string
}

export const SPACES: Space[] = [
  { slug: "exterior",    name: "Exterior",    iconKey: "exterior" },
  { slug: "living", name: "Living",      iconKey: "living_room" },
  { slug: "kitchen",     name: "Kitchen",     iconKey: "kitchen" },
  { slug: "bedroom",     name: "Bedroom",     iconKey: "bedroom" },
  { slug: "bathroom",    name: "Bathroom",    iconKey: "bathroom" },
  { slug: "home-office", name: "Home Office", iconKey: "office" },
  { slug: "hallway",     name: "Hallway",     iconKey: "hallway" },
  { slug: "garden",      name: "Garden",      iconKey: "garden" },
  { slug: "pool",        name: "Pool",        iconKey: "pool" },
  { slug: "terrace",     name: "Terrace",     iconKey: "terrace" },
  { slug: "other",       name: "Other",       iconKey: "other" },
]

export function getSpaceBySlug(slug: string): Space | undefined {
  return SPACES.find((s) => s.slug === slug)
}
