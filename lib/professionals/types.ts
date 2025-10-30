/**
 * Professional card data for display in listings and galleries.
 * Note: This type uses the company as the primary identifier since professionals
 * are displayed through their company profiles.
 */
export type ProfessionalCard = {
  /** Company ID - used as the primary identifier for routing (same as companyId) */
  id: string
  /** Company slug for URL-friendly routing */
  slug: string
  /** Company ID - identifies which company this professional belongs to */
  companyId: string
  /** Professional profile ID - the unique professional record ID */
  professionalId: string
  name: string
  profession: string
  location: string
  rating: number
  reviewCount: number
  image: string
  specialties: string[]
  isVerified: boolean
  domain?: string | null
}

export type ProfessionalGalleryImage = {
  id: string
  url: string
  altText: string | null
  isCover: boolean
}

export type ProfessionalSocialLink = {
  platform: string
  url: string
}

export type ProfessionalRatingsBreakdown = {
  overall: number
  total: number
  quality: number
  reliability: number
  communication: number
  lastReviewAt: string | null
}

export type ProfessionalProjectSummary = {
  id: string
  title: string
  slug: string | null
  location: string | null
  image: string | null
  likesCount: number | null
  projectYear: number | null
  stylePreferences: string[] | null
  projectType: string | null
}

export type ProfessionalReviewSummary = {
  id: string
  reviewerName: string
  reviewerInitials: string
  reviewerAvatarUrl: string | null
  yearsOnPlatform: number | null
  createdAt: string | null
  rating: number
  title: string | null
  comment: string | null
  workCompleted: boolean | null
}

export type ProfessionalDetail = {
  id: string
  slug: string
  name: string
  title: string
  description: string | null
  bio: string | null
  location: string | null
  specialties: string[]
  services: string[]
  languages: string[]
  yearsExperience: number | null
  hourlyRateDisplay: string | null
  isVerified: boolean
  isAvailable: boolean
  portfolioUrl: string | null
  profile: {
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
    joinedAt: string | null
  }
  company: {
    id: string
    name: string
    description: string | null
    logoUrl: string | null
    email: string | null
    phone: string | null
    website: string | null
    domain: string | null
    address: string | null
    city: string | null
    country: string | null
    primaryService: string | null
    services: string[]
    languages: string[]
    certificates: string[]
    teamSizeMin: number | null
    teamSizeMax: number | null
    foundedYear: number | null
    planTier: string | null
    planExpiresAt: string | null
    status: string | null
  }
  ratings: ProfessionalRatingsBreakdown
  gallery: ProfessionalGalleryImage[]
  socialLinks: ProfessionalSocialLink[]
  projects: ProfessionalProjectSummary[]
  reviews: ProfessionalReviewSummary[]
}
