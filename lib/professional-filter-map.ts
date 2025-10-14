export type ProfessionalCategoryConfig = {
  name: string
  slug: string
  services: readonly {
    name: string
    slug: string
  }[]
}

const makeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

export const PROFESSIONAL_CATEGORY_CONFIG: readonly ProfessionalCategoryConfig[] = [
  {
    name: "Design & Planning",
    slug: "design-planning",
    services: [
      { name: "Architecture", slug: "design-planning-architecture" },
      { name: "Interior design", slug: "design-planning-interior-design" },
      { name: "Garden design", slug: "design-planning-garden-design" },
    ],
  },
  {
    name: "Construction",
    slug: "construction",
    services: [
      { name: "General contractor", slug: "construction-general-contractor" },
      { name: "Roof", slug: "construction-roof" },
      { name: "Tiles and stone", slug: "construction-tiles-and-stone" },
      { name: "Kitchen", slug: "construction-kitchen" },
      { name: "Stairs", slug: "construction-stairs" },
      { name: "Elevator", slug: "construction-elevator" },
      { name: "Windows", slug: "construction-windows" },
      { name: "Bathroom", slug: "construction-bathroom" },
      { name: "Swimming pool", slug: "construction-swimming-pool" },
      { name: "Wellness", slug: "construction-wellness" },
      { name: "Doors", slug: "construction-doors" },
    ],
  },
  {
    name: "Systems",
    slug: "systems",
    services: [
      { name: "Lighting", slug: "systems-lighting" },
      { name: "Electrical systems", slug: "systems-electrical-systems" },
      { name: "Security systems", slug: "systems-security-systems" },
      { name: "Domotica", slug: "systems-domotica" },
    ],
  },
  {
    name: "Finishing",
    slug: "finishing",
    services: [
      { name: "Interior fit-out", slug: "finishing-interior-fit-out" },
      { name: "Fireplace", slug: "finishing-fireplace" },
      { name: "Interior styling", slug: "finishing-interior-styling" },
      { name: "Painting", slug: "finishing-painting" },
      { name: "Decoration and carpentry", slug: "finishing-decoration-and-carpentry" },
      { name: "Indoor plants", slug: "finishing-indoor-plants" },
      { name: "Floor", slug: "finishing-floor" },
      { name: "Furniture", slug: "finishing-furniture" },
      { name: "Art", slug: "finishing-art" },
    ],
  },
  {
    name: "Outdoor",
    slug: "outdoor",
    services: [
      { name: "Outdoor lighting", slug: "outdoor-outdoor-lighting" },
      { name: "Garden", slug: "outdoor-garden" },
      { name: "Garden house", slug: "outdoor-garden-house" },
      { name: "Outdoor furniture", slug: "outdoor-outdoor-furniture" },
      { name: "Fencing and gates", slug: "outdoor-fencing-and-gates" },
    ],
  },
] as const

const categorySlugSet = new Set(PROFESSIONAL_CATEGORY_CONFIG.map((item) => item.slug))
const serviceSlugSet = new Set(PROFESSIONAL_CATEGORY_CONFIG.flatMap((item) => item.services.map((service) => service.slug)))

export const isAllowedProfessionalCategorySlug = (slug: string | null | undefined): boolean => {
  if (!slug) return false
  if (categorySlugSet.has(slug)) return true
  return categorySlugSet.has(makeSlug(slug))
}

export const isAllowedProfessionalServiceSlug = (slug: string | null | undefined): boolean => {
  if (!slug) return false
  if (serviceSlugSet.has(slug)) return true
  return serviceSlugSet.has(makeSlug(slug))
}

export const PROFESSIONAL_CATEGORY_SLUGS = categorySlugSet
export const PROFESSIONAL_SERVICE_SLUGS = serviceSlugSet
