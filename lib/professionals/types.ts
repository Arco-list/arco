export type ProfessionalCard = {
  id: string
  slug: string
  companyId: string
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
    city: string | null
    country: string | null
    services: string[]
    languages: string[]
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
