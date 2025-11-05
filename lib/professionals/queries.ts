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
const INITIAL_PAGE_SIZE = 20

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
    slug: NullableString
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
  style_preferences: NullableString[] | null
  project_type: NullableString
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

  // Use primary service from company's primary_service_id (company-level data only)
  // Note: For detail queries, we need to fetch this separately since it's not in the professionals table
  const profession = "Professional services" // This will be enhanced when we add primary_service to detail query

  // Use company location (city, country)
  const locationPieces = [company.city, company.country].filter(Boolean)
  const location = locationPieces.length > 0 ? locationPieces.join(", ") : "Location unavailable"

  const specialties = Array.isArray(row.services_offered)
    ? row.services_offered.filter((value): value is string => typeof value === "string" && value.length > 0)
    : []

  const ratingValue =
    typeof rating?.overall_rating === "number" && !Number.isNaN(rating.overall_rating) ? rating.overall_rating : 0

  const reviewCount =
    typeof rating?.total_reviews === "number" && !Number.isNaN(rating.total_reviews) ? rating.total_reviews : 0

  const image = company.logo_url || profile?.avatar_url || PLACEHOLDER_IMAGE

  return {
    id: company.id,
    slug: company.slug || company.id,
    companyId: company.id,
    professionalId: row.id,
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

type SearchProfessionalsRpcRow = {
  id: string
  title: string | null
  first_name: string | null
  last_name: string | null
  user_location: string | null
  company_id: string | null
  company_name: string | null
  company_slug: string | null
  company_logo: string | null
  company_domain: string | null
  company_country: string | null
  company_state_region: string | null
  company_city: string | null
  primary_specialty: string | null
  primary_service_name: string | null
  services_offered: string[] | null
  display_rating: number | string | null
  total_reviews: number | null
  is_verified: boolean | null
  cover_photo_url: string | null
  avatar_url: string | null
}

const mapRpcRowToProfessionalCard = (row: SearchProfessionalsRpcRow): ProfessionalCard | null => {
  if (!row.id || !row.company_id) return null

  const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim()
  const name = row.company_name || fullName || "Professional"

  // Use primary service from company's primary_service_id (company-level data only)
  const profession = row.primary_service_name || "Professional services"

  // Use company location (city, country)
  const locationParts = [row.company_city, row.company_country].filter((value): value is string => Boolean(value))
  const location = locationParts.length > 0 ? locationParts.join(", ") : "Location unavailable"

  const specialties = Array.isArray(row.services_offered)
    ? row.services_offered.filter((value): value is string => Boolean(value))
    : []

  const displayRating =
    typeof row.display_rating === "number"
      ? row.display_rating
      : typeof row.display_rating === "string"
        ? Number(row.display_rating)
        : 0

  const rating = Number.isFinite(displayRating) ? Number(displayRating.toFixed(2)) : 0
  const reviewCount = typeof row.total_reviews === "number" && Number.isFinite(row.total_reviews) ? row.total_reviews : 0

  return {
    id: row.company_id,
    slug: row.company_slug || row.company_id,
    companyId: row.company_id,
    professionalId: row.id,
    name,
    profession,
    location,
    rating,
    reviewCount,
    image: row.cover_photo_url ?? row.company_logo ?? row.avatar_url ?? PLACEHOLDER_IMAGE,
    specialties,
    isVerified: Boolean(row.is_verified),
    domain: row.company_domain ?? null,
  }
}

export const fetchDiscoverProfessionals = async (): Promise<ProfessionalCard[]> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.rpc("search_professionals", {
    search_query: null,
    country_filter: null,
    state_filter: null,
    city_filter: null,
    category_filters: null,
    service_filters: null,
    min_rating: null,
    max_hourly_rate: null,
    verified_only: false,
    limit_count: INITIAL_PAGE_SIZE,
    offset_count: 0,
  })

  if (error) {
    logger.error("Failed to load professionals for discover", { function: "search_professionals", error })
    return []
  }

  const rows = Array.isArray(data) ? (data as SearchProfessionalsRpcRow[]) : []

  const cards = rows
    .map((row) => mapRpcRowToProfessionalCard(row))
    .filter((card): card is ProfessionalCard => card !== null)

  return sortProfessionals(cards)
}

export const fetchProfessionalMetadata = async (slugOrId: string): Promise<{
  id: string
  slug: string
  name: string
  description: string | null
  location: string | null
  coverImageUrl: string | null
  primaryService: string | null
  primaryServiceId: string | null
} | null> => {
  const supabase = await createServerSupabaseClient()

  // Query companies table first (company-centric approach)
  const companyResult = isUuid(slugOrId)
    ? await supabase
        .from("companies")
        .select(`
          id,
          name,
          slug,
          description,
          logo_url,
          city,
          country,
          plan_tier,
          plan_expires_at,
          status,
          primary_service_id,
          primary_service:categories!companies_primary_service_id_fkey(name),
          professionals (
            id,
            title,
            bio,
            is_verified,
            is_available,
            profiles:profiles!professionals_user_id_fkey (
              first_name,
              last_name,
              location
            )
          )
        `)
        .eq("id", slugOrId)
        .maybeSingle()
    : await supabase
        .from("companies")
        .select(`
          id,
          name,
          slug,
          description,
          logo_url,
          city,
          country,
          plan_tier,
          plan_expires_at,
          status,
          primary_service_id,
          primary_service:categories!companies_primary_service_id_fkey(name),
          professionals (
            id,
            title,
            bio,
            is_verified,
            is_available,
            profiles:profiles!professionals_user_id_fkey (
              first_name,
              last_name,
              location
            )
          )
        `)
        .eq("slug", slugOrId)
        .maybeSingle()

  if (companyResult.error) {
    logger.error("Failed to fetch company metadata", { slugOrId, supabaseError: companyResult.error })
    return null
  }

  const company = companyResult.data
  if (!company) {
    return null
  }

  // Get the first active professional for this company
  const professionals = Array.isArray(company.professionals) ? company.professionals : []
  const activeProfessional = professionals.find((p: any) => p.is_available === true) || professionals[0]

  if (!activeProfessional) {
    return null
  }

  // Check plan status
  const isPlusActive =
    company.plan_tier === "plus" &&
    company.status === "listed" &&
    (!company.plan_expires_at || new Date(company.plan_expires_at).getTime() > Date.now())

  if (!isPlusActive || activeProfessional.is_available !== true) {
    return null
  }

  const photosResult = await supabase.rpc("get_public_company_photos", { p_company_id: company.id })

  const profile = activeProfessional.profiles

  const name = company.name?.trim() ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    activeProfessional.title ||
    "Professional"

  const description = company.description || activeProfessional.bio

  const location = formatLocation([company.city, company.country], profile?.location ?? null)

  let coverImageUrl: string | null = null
  if (!photosResult.error && Array.isArray(photosResult.data)) {
    const photos = photosResult.data as CompanyPhotoRow[]
    const coverPhoto = photos.find(photo => photo.is_cover === true)
    coverImageUrl = coverPhoto?.url || photos[0]?.url || null
  }

  const primaryServiceName = (company.primary_service as { name: string } | null)?.name ?? null
  const primaryServiceId = company.primary_service_id ?? null

  return {
    id: company.id,
    slug: company.slug || company.id,
    name,
    description,
    location,
    coverImageUrl,
    primaryService: primaryServiceName,
    primaryServiceId
  }
}

export const fetchProfessionalDetail = async (slugOrId: string): Promise<ProfessionalDetail | null> => {
  const supabase = await createServerSupabaseClient()

  // Query companies table first (company-centric approach)
  const companyQuery = isUuid(slugOrId)
    ? supabase.from("companies").select("*, primary_service:categories!companies_primary_service_id_fkey(name)").eq("id", slugOrId).maybeSingle()
    : supabase.from("companies").select("*, primary_service:categories!companies_primary_service_id_fkey(name)").eq("slug", slugOrId).maybeSingle()

  const companyResult = await companyQuery

  if (companyResult.error) {
    logger.error("Failed to fetch company detail", { slugOrId, supabaseError: companyResult.error })
    return null
  }

  const company = companyResult.data

  if (!company) {
    logger.warn("Company not found", { slugOrId })
    return null
  }

  // Check plan status
  const isPlusActive =
    company.plan_tier === "plus" &&
    company.status === "listed" &&
    (!company.plan_expires_at || new Date(company.plan_expires_at).getTime() > Date.now())

  if (!isPlusActive) {
    logger.info("Company not eligible for public detail page", {
      slugOrId,
      planTier: company.plan_tier,
      companyStatus: company.status,
    })
    return null
  }

  const companyId = company.id

  // Fetch professionals for this company
  const professionalsResult = await supabase
    .from("professionals")
    .select(`
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
      companies!professionals_company_id_fkey (
        company_ratings!company_ratings_company_id_fkey (
          overall_rating,
          total_reviews,
          quality_rating,
          reliability_rating,
          communication_rating,
          last_review_at
        )
      ),
      specialties:professional_specialties (
        is_primary,
        category:categories (
          name
        )
      )
    `)
    .eq("company_id", companyId)

  if (professionalsResult.error) {
    logger.error("Failed to fetch professionals for company", { companyId, supabaseError: professionalsResult.error })
    return null
  }

  const professionals = professionalsResult.data || []

  // Get the first available professional or just the first one
  const detailRow = professionals.find((p: any) => p.is_available === true) || professionals[0]

  if (!detailRow) {
    logger.warn("No professionals found for company", { companyId })
    return null
  }

  if (detailRow.is_available !== true) {
    logger.info("Professional not available for public detail page", {
      slugOrId,
      companyId,
      professionalId: detailRow.id,
      isAvailable: detailRow.is_available,
    })
    return null
  }

  const professionalId = detailRow.id

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
      .eq("company_id", companyId)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  if (photosResult.error) {
    logger.warn("Failed to load company photos for professional detail", { slugOrId, professionalId, supabaseError: photosResult.error })
  }

  if (socialLinksResult.error) {
    if (isRlsDenied(socialLinksResult.error)) {
      logger.debug("RLS prevented loading company social links for anonymous viewer", { slugOrId, professionalId })
    } else {
      logger.warn("Failed to load company social links for professional detail", {
        slugOrId,
        professionalId,
        supabaseError: socialLinksResult.error,
      })
    }
  }

  if (projectLinksResult.error) {
    logger.warn("Failed to load project links for professional detail", { slugOrId, professionalId, supabaseError: projectLinksResult.error })
  }

  if (reviewsResult.error) {
    logger.warn("Failed to load reviews for professional detail", { slugOrId, professionalId, supabaseError: reviewsResult.error })
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
      .select("id, title, slug, location, primary_photo_url, likes_count, project_year, status, style_preferences, project_type")
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

      const projectRows = uniqueProjectIds
        .map((id) => projectMap.get(id))
        .filter((row): row is ProjectSummaryRow => Boolean(row))

      // Collect all taxonomy IDs (styles and types) to resolve their names
      const taxonomyIds = new Set<string>()
      projectRows.forEach((row) => {
        if (Array.isArray(row.style_preferences)) {
          row.style_preferences.forEach((style) => {
            if (isUuid(style)) {
              taxonomyIds.add(style)
            }
          })
        }
        if (isUuid(row.project_type)) {
          taxonomyIds.add(row.project_type)
        }
      })

      // Fetch taxonomy names from categories/taxonomy tables
      let taxonomyNameMap = new Map<string, string>()
      if (taxonomyIds.size > 0) {
        const [categoriesResult, taxonomyResult] = await Promise.all([
          supabase
            .from("categories")
            .select("id, name")
            .in("id", Array.from(taxonomyIds)),
          supabase
            .from("project_taxonomy_options")
            .select("id, name")
            .in("id", Array.from(taxonomyIds))
        ])

        if (categoriesResult.data) {
          categoriesResult.data.forEach((cat) => {
            if (cat.id && cat.name) {
              taxonomyNameMap.set(cat.id, cat.name)
            }
          })
        }

        if (taxonomyResult.data) {
          taxonomyResult.data.forEach((tax) => {
            if (tax.id && tax.name) {
              taxonomyNameMap.set(tax.id, tax.name)
            }
          })
        }
      }

      // Map projects with resolved names
      projects = projectRows.map((row) => {
        const styleIds = Array.isArray(row.style_preferences) ? row.style_preferences : []
        const resolvedStyles = styleIds
          .map((id) => (isUuid(id) ? taxonomyNameMap.get(id) ?? id : id))
          .filter(Boolean)

        const projectType = row.project_type
        const resolvedType = projectType && isUuid(projectType)
          ? taxonomyNameMap.get(projectType) ?? projectType
          : projectType

        return {
          id: row.id,
          title: row.title ?? "Project",
          slug: row.slug ?? null,
          location: row.location ?? null,
          image: row.primary_photo_url ?? null,
          likesCount: row.likes_count ?? null,
          projectYear: row.project_year ?? null,
          stylePreferences: resolvedStyles.length > 0 ? resolvedStyles : null,
          projectType: resolvedType ?? null,
        }
      })
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

  const companyRating = detailRow.companies?.company_ratings
  const ratings: ProfessionalRatingsBreakdown = {
    overall:
      typeof companyRating?.overall_rating === "number" && !Number.isNaN(companyRating.overall_rating)
        ? companyRating.overall_rating
        : 0,
    total:
      typeof companyRating?.total_reviews === "number" && !Number.isNaN(companyRating.total_reviews)
        ? companyRating.total_reviews
        : 0,
    quality:
      typeof companyRating?.quality_rating === "number" && !Number.isNaN(companyRating.quality_rating)
        ? companyRating.quality_rating
        : 0,
    reliability:
      typeof companyRating?.reliability_rating === "number" && !Number.isNaN(companyRating.reliability_rating)
        ? companyRating.reliability_rating
        : 0,
    communication:
      typeof companyRating?.communication_rating === "number" && !Number.isNaN(companyRating.communication_rating)
        ? companyRating.communication_rating
        : 0,
    lastReviewAt: companyRating?.last_review_at ?? null,
  }

  const primaryServiceName = (company.primary_service as { name: string } | null)?.name ?? null

  return {
    id: company.id,
    slug: company.slug || company.id,
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
      address: company.address ?? null,
      city: company.city ?? null,
      country: company.country ?? null,
      primaryService: primaryServiceName,
      services: companyServices,
      languages: companyLanguages,
      certificates: toNonEmptyStrings(company.certificates),
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
