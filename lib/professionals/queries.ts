import "server-only"

import type { PostgrestError } from "@supabase/supabase-js"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import type {
  ProfessionalCard,
  ProfessionalDetail,
  ProfessionalGalleryImage,
  ProfessionalProjectSummary,
  ProfessionalReviewSummary,
  ProfessionalSocialLink,
  ProfessionalRatingsBreakdown,
} from "./types"

const PLACEHOLDER_IMAGE = "/placeholder.svg?height=300&width=300"

type NullableString = string | null

type ProfessionalRow = {
  id: string
  title: NullableString
  created_at: NullableString
  is_verified: boolean | null
  is_available: boolean | null
  services_offered: NullableString[] | null
  company_id: NullableString
  profiles: {
    first_name: NullableString
    last_name: NullableString
    avatar_url: NullableString
    location: NullableString
  } | null
  company: {
    id: string
    name: string
    logo_url: NullableString
    status: NullableString
    plan_tier: NullableString
    plan_expires_at: NullableString
    city: NullableString
    country: NullableString
    domain: NullableString
  } | null
  rating: {
    overall_rating: number | null
    total_reviews: number | null
  } | null
  specialties: {
    is_primary: boolean | null
    category: {
      name: NullableString
    } | null
  }[] | null
}

type CoverPhotoRow = {
  company_id: string | null
  url: string | null
  is_cover: boolean | null
}

type ProfessionalDetailRow = ProfessionalRow & {
  bio: NullableString
  years_experience: number | null
  languages_spoken: NullableString[] | null
  hourly_rate_min: number | null
  hourly_rate_max: number | null
  portfolio_url: NullableString
  profiles: (ProfessionalRow["profiles"] & {
    created_at?: NullableString
  }) | null
  company: (ProfessionalRow["company"] & {
    description: NullableString
    email: NullableString
    phone: NullableString
    website: NullableString
    services_offered: NullableString[] | null
    languages: NullableString[] | null
    team_size_min: number | null
    team_size_max: number | null
    founded_year: number | null
  }) | null
  rating: (ProfessionalRow["rating"] & {
    quality_rating: number | null
    reliability_rating: number | null
    communication_rating: number | null
    last_review_at: NullableString
  }) | null
  specialties: {
    is_primary: boolean | null
    category: {
      name: NullableString
    } | null
  }[] | null
}

type CompanyPhotoRow = {
  id: string
  company_id?: string | null
  url: string
  alt_text: NullableString
  is_cover: boolean
  order_index: number | null
  created_at: NullableString
}

type SocialLinkRow = {
  platform: string | null
  url: string | null
}

type ProjectLinkRow = {
  project_id: string | null
  status: string | null
}

type ProjectSummaryRow = {
  id: string
  title: NullableString
  slug: NullableString
  location: NullableString
  primary_photo_url: NullableString
  likes_count: number | null
  project_year: number | null
  status: NullableString
}

type ReviewRow = {
  id: string
  created_at: NullableString
  overall_rating: number | null
  title: NullableString
  comment: NullableString
  work_completed: boolean | null
  reviewer_id: string
}

type ReviewerProfileRow = {
  id: string
  first_name: NullableString
  last_name: NullableString
  avatar_url: NullableString
  created_at: NullableString
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isUuid = (value?: string | null): value is string => typeof value === "string" && UUID_REGEX.test(value.trim())

const toNonEmptyStrings = (values: NullableString[] | null | undefined) =>
  Array.isArray(values)
    ? values
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .map((entry) => entry.trim())
    : []

const mergeUniqueStrings = (...groups: (NullableString[] | null | undefined)[]) => {
  const merged = new Set<string>()
  groups.forEach((group) => {
    toNonEmptyStrings(group).forEach((value) => merged.add(value))
  })
  return Array.from(merged)
}

const formatLocation = (primaryParts: NullableString[], fallback?: NullableString) => {
  const filteredPrimary = primaryParts.filter((part): part is string => typeof part === "string" && part.trim().length > 0)

  if (filteredPrimary.length > 0) {
    return filteredPrimary.join(", ")
  }

  return fallback && fallback.trim().length > 0 ? fallback.trim() : null
}

const formatHourlyRate = (min: number | null, max: number | null) => {
  if (typeof min !== "number" && typeof max !== "number") {
    return null
  }

  const formatter = new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  if (typeof min === "number" && typeof max === "number") {
    return `€${formatter.format(min)} - €${formatter.format(max)} / hour`
  }

  const single = typeof min === "number" ? min : max
  return typeof single === "number" ? `€${formatter.format(single)} / hour` : null
}

const calculateYearsOnPlatform = (createdAt: NullableString) => {
  if (!createdAt) {
    return null
  }

  const createdDate = new Date(createdAt)

  if (Number.isNaN(createdDate.getTime())) {
    return null
  }

  const now = new Date()
  const years = now.getFullYear() - createdDate.getFullYear()
  const anniversaryPassed =
    now.getMonth() > createdDate.getMonth() ||
    (now.getMonth() === createdDate.getMonth() && now.getDate() >= createdDate.getDate())

  return anniversaryPassed ? years : years - 1
}

const buildInitials = (firstName: NullableString, lastName: NullableString) => {
  const initials = [firstName, lastName]
    .map((value) => (value && value.trim().length > 0 ? value.trim()[0]?.toUpperCase() ?? "" : ""))
    .join("")

  return initials || "A"
}

const isRlsDenied = (error: PostgrestError | null) =>
  Boolean(error?.code === "42501" || error?.code === "PGRST301" || error?.message?.toLowerCase().includes("row-level security"))

const isPlusPlanActive = (row: ProfessionalRow) => {
  const company = row.company
  if (!company) {
    return false
  }

  if (company.plan_tier !== "plus") {
    return false
  }

  if (company.status !== "listed") {
    return false
  }

  if (!company.plan_expires_at) {
    return true
  }

  const expiresAt = new Date(company.plan_expires_at).getTime()
  const now = Date.now()
  return expiresAt > now
}

const toProfessionalCard = (row: ProfessionalRow): ProfessionalCard | null => {
  if (!row.company_id || !row.company || !row.id) {
    return null
  }

  const company = row.company
  const profile = row.profiles
  const rating = row.rating

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim()
  const name = company.name || fullName || "Professional"

  // Use services_offered if title appears to be a name (matches first_name or last_name)
  const titleLooksLikeName =
    row.title && profile && (
      row.title.toLowerCase() === profile.first_name?.toLowerCase() ||
      row.title.toLowerCase() === profile.last_name?.toLowerCase()
    )

  // Get primary specialty name from specialties, or use services_offered as fallback
  const primarySpecialty = Array.isArray(row.specialties)
    ? row.specialties.find(s => s.is_primary)?.category?.name ||
      row.specialties[0]?.category?.name
    : null

  const profession =
    (row.title && !titleLooksLikeName)
      ? row.title
      : primarySpecialty ||
        (Array.isArray(row.services_offered) && row.services_offered.length > 0
          ? row.services_offered[0] ?? "Professional"
          : "Professional")

  const locationPieces = [company.city, company.country].filter(Boolean)
  const location =
    locationPieces.length > 0
      ? locationPieces.join(", ")
      : profile?.location || "Location unavailable"

  const specialties = Array.isArray(row.services_offered)
    ? row.services_offered.filter((value): value is string => typeof value === "string" && value.length > 0)
    : []

  const ratingValue =
    typeof rating?.overall_rating === "number" && !Number.isNaN(rating.overall_rating) ? rating.overall_rating : 0

  const reviewCount =
    typeof rating?.total_reviews === "number" && !Number.isNaN(rating.total_reviews) ? rating.total_reviews : 0

  const image = company.logo_url || profile?.avatar_url || PLACEHOLDER_IMAGE

  return {
    id: row.id,
    slug: row.id,
    companyId: company.id,
    name,
    profession,
    location,
    rating: Number(ratingValue.toFixed(2)),
    reviewCount,
    image,
    specialties,
    isVerified: Boolean(row.is_verified),
    domain: company.domain ?? null,
  }
}

const sortProfessionals = (professionals: ProfessionalCard[]) => {
  return professionals.sort((a, b) => {
    if (a.isVerified !== b.isVerified) {
      return a.isVerified ? -1 : 1
    }

    if (a.rating !== b.rating) {
      return b.rating - a.rating
    }

    if (a.reviewCount !== b.reviewCount) {
      return b.reviewCount - a.reviewCount
    }

    return a.name.localeCompare(b.name)
  })
}

export const fetchDiscoverProfessionals = async (): Promise<ProfessionalCard[]> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from("professionals")
    .select(
      `
        id,
        title,
        created_at,
        is_verified,
        is_available,
        services_offered,
        company_id,
        profiles:profiles!professionals_user_id_fkey (
          first_name,
          last_name,
          avatar_url,
          location
        ),
        company:companies (
          id,
          name,
          logo_url,
          status,
          plan_tier,
          plan_expires_at,
          city,
          country,
          domain
        ),
        rating:professional_ratings (
          overall_rating,
          total_reviews
        ),
        specialties:professional_specialties (
          is_primary,
          category:categories (
            name
          )
        )
      `
    )
    .not("company_id", "is", null)
    .eq("is_available", true)
    .eq("company.plan_tier", "plus")
    .eq("company.status", "listed")
    .limit(100)

  if (error) {
    logger.error("Failed to load professionals for discover", { table: "professionals", error })
    return []
  }

  const rows = Array.isArray(data) ? (data as ProfessionalRow[]) : []

  const plusProfessionals = rows.filter((row) => isPlusPlanActive(row))

  const cards = plusProfessionals
    .map((row) => toProfessionalCard(row))
    .filter((card): card is ProfessionalCard => card !== null)

  const bestCardByCompany = cards.reduce<Map<string, ProfessionalCard>>((acc, card) => {
    const existing = acc.get(card.companyId)

    if (!existing) {
      acc.set(card.companyId, card)
      return acc
    }

    const hasBetterRating = card.rating > existing.rating
    const hasEqualRatingMoreReviews = card.rating === existing.rating && card.reviewCount > existing.reviewCount

    if (hasBetterRating || hasEqualRatingMoreReviews) {
      acc.set(card.companyId, card)
    }

    return acc
  }, new Map())

  const uniqueCards = Array.from(bestCardByCompany.values())

  if (uniqueCards.length === 0) {
    return []
  }

  const companyIds = Array.from(new Set(uniqueCards.map((card) => card.companyId))).filter((id) => id.length > 0)

  if (companyIds.length === 0) {
    return sortProfessionals(uniqueCards)
  }

  const { data: coverPhotos, error: coverError } = await supabase
    .from("company_photos")
    .select("company_id, url, is_cover")
    .in("company_id", companyIds)
    .eq("is_cover", true)

  if (coverError) {
    logger.warn("Failed to load company cover photos for professionals", { companyIds, supabaseError: coverError })
    return sortProfessionals(uniqueCards)
  }

  const coverPhotoMap = new Map<string, string>()
  const coverPhotoRows: CoverPhotoRow[] = Array.isArray(coverPhotos) ? (coverPhotos as CoverPhotoRow[]) : []

  coverPhotoRows.forEach((photo) => {
    if (photo?.company_id && typeof photo.url === "string" && photo.url.length > 0 && !coverPhotoMap.has(photo.company_id)) {
      coverPhotoMap.set(photo.company_id, photo.url)
    }
  })

  const cardsWithCovers = uniqueCards.map((card) => {
    const coverUrl = coverPhotoMap.get(card.companyId)
    if (!coverUrl) {
      return card
    }

    return {
      ...card,
      image: coverUrl,
    }
  })

  return sortProfessionals(cardsWithCovers)
}

export const fetchProfessionalDetail = async (professionalId: string): Promise<ProfessionalDetail | null> => {
  if (!isUuid(professionalId)) {
    logger.warn("Attempted to load professional detail with invalid id", { professionalId })
    return null
  }

  const supabase = await createServerSupabaseClient()

  const professionalResult = await supabase
    .from("professionals")
    .select(
      `
        id,
        title,
        bio,
        years_experience,
        services_offered,
        languages_spoken,
        hourly_rate_min,
        hourly_rate_max,
        is_verified,
        is_available,
        portfolio_url,
        company_id,
        profiles:profiles!professionals_user_id_fkey (
          first_name,
          last_name,
          avatar_url,
          location,
          created_at
        ),
        company:companies (
          id,
          name,
          description,
          logo_url,
          email,
          phone,
          website,
          domain,
          city,
          country,
          services_offered,
          languages,
          plan_tier,
          plan_expires_at,
          status,
          team_size_min,
          team_size_max,
          founded_year
        ),
        rating:professional_ratings (
          overall_rating,
          total_reviews,
          quality_rating,
          reliability_rating,
          communication_rating,
          last_review_at
        ),
        specialties:professional_specialties (
          is_primary,
          category:categories (
            name
          )
        )
      `
    )
    .eq("id", professionalId)
    .maybeSingle<ProfessionalDetailRow>()

  if (professionalResult.error) {
    logger.error("Failed to fetch professional detail", { professionalId, supabaseError: professionalResult.error })
    return null
  }

  const detailRow = professionalResult.data

  if (!detailRow || !detailRow.company) {
    logger.warn("Professional detail missing company", { professionalId })
    return null
  }

  if (!isPlusPlanActive(detailRow) || detailRow.is_available !== true) {
    logger.info("Professional not eligible for public detail page", {
      professionalId,
      planTier: detailRow.company.plan_tier,
      companyStatus: detailRow.company.status,
      isAvailable: detailRow.is_available,
    })
    return null
  }

  const companyId = detailRow.company.id

  const [photosResult, socialLinksResult, projectLinksResult, reviewsResult] = await Promise.all([
    supabase.rpc("get_public_company_photos", { p_company_id: companyId }),
    supabase.from("company_social_links").select("platform, url").eq("company_id", companyId),
    supabase
      .from("project_professionals")
      .select("project_id, status")
      .eq("professional_id", professionalId)
      .limit(50),
    supabase
      .from("reviews")
      .select("id, created_at, overall_rating, title, comment, work_completed, reviewer_id")
      .eq("professional_id", professionalId)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  if (photosResult.error) {
    logger.warn("Failed to load company photos for professional detail", { professionalId, supabaseError: photosResult.error })
  }

  if (socialLinksResult.error) {
    if (isRlsDenied(socialLinksResult.error)) {
      logger.debug("RLS prevented loading company social links for anonymous viewer", { professionalId })
    } else {
      logger.warn("Failed to load company social links for professional detail", {
        professionalId,
        supabaseError: socialLinksResult.error,
      })
    }
  }

  if (projectLinksResult.error) {
    logger.warn("Failed to load project links for professional detail", { professionalId, supabaseError: projectLinksResult.error })
  }

  if (reviewsResult.error) {
    logger.warn("Failed to load reviews for professional detail", { professionalId, supabaseError: reviewsResult.error })
  }

  const galleryRows = Array.isArray(photosResult.data) ? (photosResult.data as CompanyPhotoRow[]) : []
  const gallery: ProfessionalGalleryImage[] = galleryRows
    .filter((row) => typeof row?.url === "string" && row.url.length > 0)
    .map((row) => ({
      id: row.id,
      url: row.url,
      altText: row.alt_text ?? null,
      isCover: row.is_cover === true,
    }))

  const socialRows = Array.isArray(socialLinksResult.data) ? (socialLinksResult.data as SocialLinkRow[]) : []
  const socialLinks: ProfessionalSocialLink[] = socialRows
    .filter((row) => typeof row?.platform === "string" && row.platform.length > 0 && typeof row?.url === "string" && row.url.length > 0)
    .map((row) => ({
      platform: row.platform as string,
      url: row.url as string,
    }))

  const linkRows = Array.isArray(projectLinksResult.data) ? (projectLinksResult.data as ProjectLinkRow[]) : []
  const allowedStatuses = new Set(["live_on_page", "listed"])
  const projectIds = linkRows
    .filter((row) => typeof row?.project_id === "string" && allowedStatuses.has(String(row.status)))
    .map((row) => row.project_id as string)

  const uniqueProjectIds = Array.from(new Set(projectIds)).slice(0, 12)

  let projects: ProfessionalProjectSummary[] = []

  if (uniqueProjectIds.length > 0) {
    const projectSummariesResult = await supabase
      .from("mv_project_summary")
      .select("id, title, slug, location, primary_photo_url, likes_count, project_year, status")
      .in("id", uniqueProjectIds)

    if (projectSummariesResult.error) {
      logger.warn("Failed to load project summaries for professional detail", {
        professionalId,
        supabaseError: projectSummariesResult.error,
      })
    } else {
      const projectSummaryRows = Array.isArray(projectSummariesResult.data)
        ? (projectSummariesResult.data as ProjectSummaryRow[])
        : []

      const projectMap = new Map(
        projectSummaryRows
          .filter((row) => row && row.id)
          .filter((row) => row.status === "published")
          .map((row) => [row.id, row])
      )

      projects = uniqueProjectIds
        .map((id) => projectMap.get(id))
        .filter((row): row is ProjectSummaryRow => Boolean(row))
        .map((row) => ({
          id: row.id,
          title: row.title ?? "Project",
          slug: row.slug ?? null,
          location: row.location ?? null,
          image: row.primary_photo_url ?? null,
          likesCount: row.likes_count ?? null,
          projectYear: row.project_year ?? null,
        }))
    }
  }

  const reviewRows = Array.isArray(reviewsResult.data) ? (reviewsResult.data as ReviewRow[]) : []
  const reviewerIds = Array.from(
    new Set(
      reviewRows
        .map((row) => row.reviewer_id)
        .filter((id): id is string => typeof id === "string" && isUuid(id)),
    ),
  )

  let reviewerProfiles = new Map<string, ReviewerProfileRow>()

  if (reviewerIds.length > 0) {
    const { data: reviewerProfilesData, error: reviewerProfilesError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url, created_at")
      .in("id", reviewerIds)

    if (reviewerProfilesError) {
      logger.warn("Failed to load reviewer profiles for professional detail", {
        professionalId,
        supabaseError: reviewerProfilesError,
      })
    } else {
      const profileRows = Array.isArray(reviewerProfilesData)
        ? (reviewerProfilesData as ReviewerProfileRow[])
        : []

      reviewerProfiles = new Map(
        profileRows
          .filter((row): row is ReviewerProfileRow => Boolean(row && typeof row.id === "string" && isUuid(row.id)))
          .map((row) => [row.id, row]),
      )
    }
  }

  const reviews: ProfessionalReviewSummary[] = reviewRows.map((row) => {
    const reviewerProfile = reviewerProfiles.get(row.reviewer_id) ?? null
    const reviewerName = [reviewerProfile?.first_name, reviewerProfile?.last_name]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .join(" ")
      .trim()

    const yearsOnPlatform = calculateYearsOnPlatform(reviewerProfile?.created_at ?? null)

    return {
      id: row.id,
      reviewerName: reviewerName || "Verified homeowner",
      reviewerInitials: buildInitials(reviewerProfile?.first_name ?? null, reviewerProfile?.last_name ?? null),
      reviewerAvatarUrl: reviewerProfile?.avatar_url ?? null,
      yearsOnPlatform: typeof yearsOnPlatform === "number" && yearsOnPlatform >= 0 ? yearsOnPlatform : null,
      createdAt: row.created_at ?? null,
      rating: typeof row.overall_rating === "number" ? row.overall_rating : 0,
      title: row.title ?? null,
      comment: row.comment ?? null,
      workCompleted: row.work_completed,
    }
  })

  const profile = detailRow.profiles ?? {
    first_name: null,
    last_name: null,
    avatar_url: null,
    location: null,
    created_at: null,
  }

  const company = detailRow.company
  const name =
    (company.name && company.name.trim().length > 0 ? company.name.trim() : null) ??
    ([profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
      detailRow.title ||
      "Professional")

  const location = formatLocation([company.city, company.country], profile.location ?? null)
  const specialties =
    detailRow.specialties
      ?.map((entry) => entry?.category?.name?.trim())
      .filter((value): value is string => typeof value === "string" && value.length > 0) ?? []

  const companyServicesRaw = toNonEmptyStrings(company.services_offered)
  const rawServices = mergeUniqueStrings(company.services_offered, detailRow.services_offered)
  const serviceIds = rawServices.filter((value) => isUuid(value))
  let serviceNameMap = new Map<string, string>()

  if (serviceIds.length > 0) {
    const { data: serviceCategories, error: serviceCategoryError } = await supabase
      .from("categories")
      .select("id, name")
      .in("id", serviceIds)

    if (serviceCategoryError) {
      logger.warn("Failed to load service category names for professional detail", {
        professionalId,
        serviceIds,
        supabaseError: serviceCategoryError,
      })
    } else if (Array.isArray(serviceCategories)) {
      serviceNameMap = new Map(
        serviceCategories
          .filter(
            (row): row is { id: string; name: string } =>
              Boolean(row && typeof row.id === "string" && isUuid(row.id) && typeof row.name === "string" && row.name.trim().length > 0),
          )
          .map((row) => [row.id, row.name.trim()]),
      )
    }
  }

  const resolveServiceLabels = (values: string[]) =>
    Array.from(
      new Set(
        values
          .map((value) => {
            if (isUuid(value)) {
              return serviceNameMap.get(value) ?? null
            }
            return value
          })
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          .map((value) => value.trim()),
      ),
    )

  const services = resolveServiceLabels(rawServices)
  const companyServices = resolveServiceLabels(companyServicesRaw)
  const companyLanguages = toNonEmptyStrings(company.languages)
  const languages = mergeUniqueStrings(company.languages, detailRow.languages_spoken)

  const ratings: ProfessionalRatingsBreakdown = {
    overall:
      typeof detailRow.rating?.overall_rating === "number" && !Number.isNaN(detailRow.rating.overall_rating)
        ? detailRow.rating.overall_rating
        : 0,
    total:
      typeof detailRow.rating?.total_reviews === "number" && !Number.isNaN(detailRow.rating.total_reviews)
        ? detailRow.rating.total_reviews
        : 0,
    quality:
      typeof detailRow.rating?.quality_rating === "number" && !Number.isNaN(detailRow.rating.quality_rating)
        ? detailRow.rating.quality_rating
        : 0,
    reliability:
      typeof detailRow.rating?.reliability_rating === "number" && !Number.isNaN(detailRow.rating.reliability_rating)
        ? detailRow.rating.reliability_rating
        : 0,
    communication:
      typeof detailRow.rating?.communication_rating === "number" && !Number.isNaN(detailRow.rating.communication_rating)
        ? detailRow.rating.communication_rating
        : 0,
    lastReviewAt: detailRow.rating?.last_review_at ?? null,
  }

  return {
    id: detailRow.id,
    slug: detailRow.id,
    name,
    title: detailRow.title ?? "Professional",
    description: company.description ?? detailRow.bio ?? null,
    bio: detailRow.bio ?? null,
    location,
    specialties,
    services,
    languages,
    yearsExperience: detailRow.years_experience ?? null,
    hourlyRateDisplay: formatHourlyRate(detailRow.hourly_rate_min ?? null, detailRow.hourly_rate_max ?? null),
    isVerified: Boolean(detailRow.is_verified),
    isAvailable: Boolean(detailRow.is_available),
    portfolioUrl: detailRow.portfolio_url ?? null,
    profile: {
      firstName: profile.first_name ?? null,
      lastName: profile.last_name ?? null,
      avatarUrl: profile.avatar_url ?? null,
      joinedAt: profile.created_at ?? null,
    },
    company: {
      id: company.id,
      name: company.name ?? name,
      description: company.description ?? null,
      logoUrl: company.logo_url ?? null,
      email: company.email ?? null,
      phone: company.phone ?? null,
      website: company.website ?? null,
      domain: company.domain ?? null,
      city: company.city ?? null,
      country: company.country ?? null,
      services: companyServices,
      languages: companyLanguages,
      teamSizeMin: company.team_size_min ?? null,
      teamSizeMax: company.team_size_max ?? null,
      foundedYear: company.founded_year ?? null,
      planTier: company.plan_tier ?? null,
      planExpiresAt: company.plan_expires_at ?? null,
      status: company.status ?? null,
    },
    ratings,
    gallery,
    socialLinks,
    projects,
    reviews,
  }
}
