import "server-only"

import type { PostgrestError } from "@supabase/supabase-js"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import {
  getProjectTranslation,
  translateBuildingTypeInput,
  translateCategoryName,
  translateProfessionalService,
  translateProjectStyle,
  translateScopeInput,
} from "@/lib/project-translations"
import type {
  ProfessionalCard,
  ProfessionalDetail,
  ProfessionalGalleryImage,
  ProfessionalProjectSummary,
  ProfessionalSocialLink,
} from "./types"
import { DEFAULT_PROFESSIONAL_SORT, type ProfessionalSort } from "./sort"

const PLACEHOLDER_IMAGE = "/placeholder.svg?height=300&width=300"
// First-page fetch for the discover grid leaves a slot for the inline map
// card: 14 pros + 1 map card = 15 = 5 full rows on desktop (3 cols).
const INITIAL_PAGE_SIZE = 14

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
  cover_photo_id: string | null
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

  if (company.status !== "listed" && company.status !== "prospected") {
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

  const image = company.logo_url || profile?.avatar_url || PLACEHOLDER_IMAGE

  return {
    id: company.id,
    slug: company.slug || company.id,
    companyId: company.id,
    professionalId: row.id,
    name,
    profession,
    location,
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
  company_latitude: number | null
  company_longitude: number | null
  primary_specialty: string | null
  primary_service_name: string | null
  services_offered: string[] | null
  is_verified: boolean | null
  cover_photo_url: string | null
  avatar_url: string | null
  specialty_ids: string[] | null
  specialty_parent_ids: string[] | null
  credited_sum?: number
  views_count?: number
  is_featured?: boolean
}

const mapRpcRowToProfessionalCard = (row: SearchProfessionalsRpcRow, locale: string = "en"): ProfessionalCard | null => {
  const companyId = row.company_id
  if (!companyId) return null

  const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim()
  const name = row.company_name || fullName || "Professional"

  // The RPC returns the English service name; translate it to the caller's
  // locale using the curated PROFESSIONAL_SERVICE_LABELS map.
  const profession =
    translateProfessionalService(row.primary_service_name, locale)
    ?? row.primary_service_name
    ?? "Professional services"

  // Use company location (city, country)
  const locationParts = [row.company_city, row.company_country].filter((value): value is string => Boolean(value))
  const location = locationParts.length > 0 ? locationParts.join(", ") : "Location unavailable"

  const specialties = Array.isArray(row.services_offered)
    ? row.services_offered
        .filter((value): value is string => Boolean(value))
        .map((value) => translateProfessionalService(value, locale) ?? value)
    : []

  return {
    id: companyId,
    slug: row.company_slug || companyId,
    companyId: companyId,
    professionalId: row.id,
    name,
    profession,
    location,
    image: row.cover_photo_url ?? row.company_logo ?? row.avatar_url ?? PLACEHOLDER_IMAGE,
    logoUrl: row.company_logo ?? null,
    specialties,
    isVerified: Boolean(row.is_verified),
    domain: row.company_domain ?? null,
    latitude: row.company_latitude ?? null,
    longitude: row.company_longitude ?? null,
    specialtyIds: Array.isArray(row.specialty_ids) ? row.specialty_ids : [],
    specialtyParentIds: Array.isArray(row.specialty_parent_ids) ? row.specialty_parent_ids : [],
    city: row.company_city ? row.company_city.toLowerCase().trim() : null,
  }
}

export interface DiscoverProfessionalsResult {
  professionals: ProfessionalCard[]
  /** Total matching professionals (all pages), not just the initial slice. */
  total: number
}

export const fetchDiscoverProfessionals = async (
  locale: string = "en",
  sort: ProfessionalSort = DEFAULT_PROFESSIONAL_SORT,
): Promise<DiscoverProfessionalsResult> => {
  const supabase = await createServerSupabaseClient()

  // Keep the "no filter" shape identical for both RPCs so the count matches
  // exactly what the client would compute once filters are applied.
  const filterParams = {
    search_query: null,
    country_filter: null,
    state_filter: null,
    city_filters: null,
    category_filters: null,
    service_filters: null,
    min_rating: null,
    max_hourly_rate: null,
    verified_only: false,
  }

  const [searchResult, countResult] = await Promise.all([
    supabase.rpc("search_professionals", {
      ...filterParams,
      limit_count: INITIAL_PAGE_SIZE,
      offset_count: 0,
      sort_by: sort,
    }),
    supabase.rpc("count_professionals", filterParams),
  ])

  if (searchResult.error) {
    logger.error("Failed to load professionals for discover", { function: "search_professionals", error: searchResult.error })
    return { professionals: [], total: 0 }
  }
  if (countResult.error) {
    logger.warn("Failed to count professionals for discover", { function: "count_professionals", error: countResult.error })
  }

  const rows = Array.isArray(searchResult.data) ? (searchResult.data as SearchProfessionalsRpcRow[]) : []

  const cards = rows
    .map((row) => mapRpcRowToProfessionalCard(row, locale))
    .filter((card): card is ProfessionalCard => card !== null)

  const professionals = sortProfessionals(cards)
  const total = countResult.data != null ? Number(countResult.data) : professionals.length

  return { professionals, total }
}

export const fetchProfessionalMetadata = async (
  slugOrId: string,
  options?: { locale?: string },
): Promise<{
  id: string
  slug: string
  name: string
  description: string | null
  location: string | null
  city: string | null
  country: string | null
  coverImageUrl: string | null
  primaryService: string | null
  primaryServiceId: string | null
  parentCategory: { id: string; name: string; slug: string | null } | null
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
          primary_service:categories!companies_primary_service_id_fkey(name, name_nl, parent_id),
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
          primary_service:categories!companies_primary_service_id_fkey(name, name_nl, parent_id),
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

  // Only require listed status
  if (company.status !== "listed" && company.status !== "prospected") {
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

  const locale = options?.locale ?? "en"
  const primaryServiceRow = company.primary_service as
    | { name: string; name_nl?: string | null; parent_id?: string | null }
    | null
  const rawPrimaryServiceName = primaryServiceRow?.name ?? null
  const primaryServiceName =
    (locale === "nl" && primaryServiceRow?.name_nl) ||
    translateProfessionalService(rawPrimaryServiceName, locale) ||
    rawPrimaryServiceName
  const primaryServiceId = company.primary_service_id ?? null
  const parentCategoryId = primaryServiceRow?.parent_id ?? null

  // Fetch parent category if it exists
  let parentCategory: { id: string; name: string; slug: string | null } | null = null
  if (parentCategoryId) {
    const { data: parentData } = await supabase
      .from("categories")
      .select("id, name, name_nl, slug")
      .eq("id", parentCategoryId)
      .maybeSingle()

    if (parentData) {
      const parentLocalizedName =
        (locale === "nl" && parentData.name_nl) ||
        translateProfessionalService(parentData.slug ?? parentData.name, locale) ||
        parentData.name
      parentCategory = {
        id: parentData.id,
        name: parentLocalizedName,
        slug: parentData.slug
      }
    }
  }

  return {
    id: company.id,
    slug: company.slug || company.id,
    name,
    description,
    location,
    city: company.city,
    country: company.country,
    coverImageUrl,
    primaryService: primaryServiceName,
    primaryServiceId,
    parentCategory
  }
}

export const fetchProfessionalDetail = async (slugOrId: string, options?: { allowUnlisted?: boolean; locale?: string }): Promise<ProfessionalDetail | null> => {
  const supabase = await createServerSupabaseClient()

  // Query companies table first (company-centric approach)
  const companyQuery = isUuid(slugOrId)
    ? supabase.from("companies").select("*, primary_service:categories!companies_primary_service_id_fkey(name, name_nl)").eq("id", slugOrId).maybeSingle()
    : supabase.from("companies").select("*, primary_service:categories!companies_primary_service_id_fkey(name, name_nl)").eq("slug", slugOrId).maybeSingle()

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

  // Public detail page accepts the same status set as the listing/homepage
  // queries: listed (claimed + active) and prospected (unclaimed but
  // editorially curated). Owners/members get a preview for any status via
  // allowUnlisted.
  const PUBLIC_COMPANY_STATUSES = ["listed", "prospected"] as const
  if (
    !PUBLIC_COMPANY_STATUSES.includes(company.status as (typeof PUBLIC_COMPANY_STATUSES)[number]) &&
    !options?.allowUnlisted
  ) {
    logger.info("Company not publicly visible", { slugOrId, companyStatus: company.status })
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

  // Companies without professionals (unclaimed) are still valid — use company data directly
  const professionalId = detailRow?.id ?? null

  const projectLinksQuery = professionalId
    ? supabase
        .from("project_professionals")
        .select("project_id, status, cover_photo_id")
        .or(`professional_id.eq.${professionalId},company_id.eq.${companyId}`)
        .limit(50)
    : supabase
        .from("project_professionals")
        .select("project_id, status, cover_photo_id")
        .eq("company_id", companyId)
        .limit(50)

  const [photosResult, socialLinksResult, projectLinksResult] = await Promise.all([
    supabase.rpc("get_public_company_photos", { p_company_id: companyId }),
    supabase.from("company_social_links").select("platform, url").eq("company_id", companyId),
    projectLinksQuery,
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
  const allowedStatuses = new Set(["live_on_page"])
  const filteredLinks = linkRows
    .filter((row) => typeof row?.project_id === "string" && allowedStatuses.has(String(row.status)))

  const projectIds = filteredLinks.map((row) => row.project_id as string)
  const uniqueProjectIds = Array.from(new Set(projectIds)).slice(0, 12)

  // Build map of project_id → cover_photo_id for contributor-specific covers
  const coverPhotoIdMap = new Map<string, string>()
  for (const row of filteredLinks) {
    if (row.project_id && row.cover_photo_id) {
      coverPhotoIdMap.set(row.project_id, row.cover_photo_id)
    }
  }

  let projects: ProfessionalProjectSummary[] = []

  if (uniqueProjectIds.length > 0) {
    // Fetch cover photo URLs for contributor-specific covers
    const coverPhotoIds = Array.from(coverPhotoIdMap.values())
    let coverPhotoUrlMap = new Map<string, string>()
    if (coverPhotoIds.length > 0) {
      const coverPhotosResult = await supabase
        .from("project_photos")
        .select("id, url")
        .in("id", coverPhotoIds)
      if (coverPhotosResult.data) {
        for (const photo of coverPhotosResult.data) {
          if (photo.id && photo.url) {
            coverPhotoUrlMap.set(photo.id, photo.url)
          }
        }
      }
    }

    const projectSummariesResult = await supabase
      .from("mv_project_summary")
      .select("id, title, translations, slug, location, primary_photo_url, likes_count, project_year, status, style_preferences, project_type, building_type, primary_category, primary_category_slug")
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
        if (isUuid((row as any).primary_category)) {
          taxonomyIds.add((row as any).primary_category)
        }
      })

      // Fetch taxonomy names from categories/taxonomy tables
      let taxonomyNameMap = new Map<string, string>()
      if (taxonomyIds.size > 0) {
        const [categoriesResult, taxonomyResult] = await Promise.all([
          supabase
            .from("categories")
            .select("id, name, slug")
            .in("id", Array.from(taxonomyIds)),
          supabase
            .from("project_taxonomy_options")
            .select("id, name, slug, taxonomy_type")
            .in("id", Array.from(taxonomyIds))
        ])

        if (categoriesResult.data) {
          categoriesResult.data.forEach((cat) => {
            if (cat.id && cat.name) {
              const translated = translateCategoryName(cat.slug ?? cat.name, options?.locale ?? "en")
              taxonomyNameMap.set(cat.id, translated ?? cat.name)
            }
          })
        }

        if (taxonomyResult.data) {
          taxonomyResult.data.forEach((tax) => {
            if (tax.id && tax.name) {
              const translated = tax.taxonomy_type === "project_style"
                ? translateProjectStyle(tax.slug ?? tax.name, options?.locale ?? "en")
                : null
              taxonomyNameMap.set(tax.id, translated ?? tax.name)
            }
          })
        }
      }

      // Map projects with resolved names
      projects = projectRows.map((row) => {
        const styleIds = Array.isArray(row.style_preferences) ? row.style_preferences : []
        const resolvedStyles = styleIds
          .map((id) =>
            isUuid(id)
              ? taxonomyNameMap.get(id) ?? id
              : translateProjectStyle(id, options?.locale ?? "en") ?? id,
          )
          .filter(Boolean)

        // Resolve the display string for the card subtitle. Priority:
        //   1. mv_project_summary.primary_category (+ slug) — a category
        //      picked via project_categories (e.g. "Villa"). Translated via
        //      the category map.
        //   2. projects.building_type — kebab-case slug (villa, house,
        //      garden-house). Translated via the building-type map.
        //   3. projects.project_type — a scope display string
        //      ("Interior Design", "New Build", "Renovation"). Translated
        //      via the scope map.
        //   4. Legacy UUID stored on project_type → taxonomy name map.
        //   5. Raw value as a last resort.
        const locale = options?.locale ?? "en"
        const primaryCategory = (row as any).primary_category as string | null
        const primaryCategorySlug = (row as any).primary_category_slug as string | null
        const buildingType = (row as any).building_type as string | null
        const rawProjectType = row.project_type as string | null

        const resolvedType = (() => {
          if (primaryCategory) {
            return translateCategoryName(primaryCategorySlug ?? primaryCategory, locale) ?? primaryCategory
          }
          const translatedBuildingType = translateBuildingTypeInput(buildingType, locale)
          if (translatedBuildingType) return translatedBuildingType
          const translatedScope = translateScopeInput(rawProjectType, locale)
          if (translatedScope) return translatedScope
          if (rawProjectType && isUuid(rawProjectType)) {
            return taxonomyNameMap.get(rawProjectType) ?? rawProjectType
          }
          return translateCategoryName(rawProjectType, locale) ?? rawProjectType
        })()

        // Use contributor's custom cover photo if set, otherwise fall back to primary_photo_url
        const customCoverPhotoId = coverPhotoIdMap.get(row.id)
        const customCoverUrl = customCoverPhotoId ? coverPhotoUrlMap.get(customCoverPhotoId) : null
        const image = customCoverUrl ?? row.primary_photo_url ?? null

        const localizedTitle =
          getProjectTranslation(
            { title: row.title, translations: (row as any).translations ?? null },
            "title",
            options?.locale ?? "en",
          ) || row.title

        return {
          id: row.id,
          title: localizedTitle ?? "Project",
          slug: row.slug ?? null,
          location: row.location ?? null,
          image,
          likesCount: row.likes_count ?? null,
          projectYear: row.project_year ?? null,
          stylePreferences: resolvedStyles.length > 0 ? resolvedStyles : null,
          projectType: resolvedType ?? null,
        }
      })
    }
  }

  const profile = detailRow?.profiles ?? {
    first_name: null,
    last_name: null,
    avatar_url: null,
    location: null,
    created_at: null,
  }

  const name =
    (company.name && company.name.trim().length > 0 ? company.name.trim() : null) ??
    ([profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
      detailRow?.title ||
      "Professional")

  const detailLocale = options?.locale ?? "en"
  const localizeServiceName = (name: string | null | undefined): string | null => {
    if (!name) return null
    return translateProfessionalService(name, detailLocale) ?? name
  }

  const location = formatLocation([company.city, company.country], profile.location ?? null)
  const specialties =
    detailRow?.specialties
      ?.map((entry) => {
        const raw = entry?.category?.name?.trim()
        if (!raw) return null
        return localizeServiceName(raw)
      })
      .filter((value): value is string => typeof value === "string" && value.length > 0) ?? []

  const companyServicesRaw = toNonEmptyStrings(company.services_offered)
  const rawServices = mergeUniqueStrings(company.services_offered, detailRow?.services_offered ?? null)
  const serviceIds = rawServices.filter((value) => isUuid(value))
  let serviceNameMap = new Map<string, string>()

  if (serviceIds.length > 0) {
    const { data: serviceCategories, error: serviceCategoryError } = await supabase
      .from("categories")
      .select("id, name, name_nl, slug")
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
            (row): row is { id: string; name: string; name_nl: string | null; slug: string | null } =>
              Boolean(row && typeof row.id === "string" && isUuid(row.id) && typeof row.name === "string" && row.name.trim().length > 0),
          )
          .map((row) => {
            const name = row.name.trim()
            const localized =
              (detailLocale === "nl" && row.name_nl) ||
              translateProfessionalService(row.slug ?? name, detailLocale) ||
              name
            return [row.id, localized]
          }),
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
            return localizeServiceName(value)
          })
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          .map((value) => value.trim()),
      ),
    )

  const services = resolveServiceLabels(rawServices)
  const companyServices = resolveServiceLabels(companyServicesRaw)
  const companyLanguages = toNonEmptyStrings(company.languages)
  const languages = mergeUniqueStrings(company.languages, detailRow?.languages_spoken ?? null)

  const primaryServiceRow = company.primary_service as { name: string; name_nl?: string | null } | null
  const rawPrimaryServiceName = primaryServiceRow?.name ?? null
  const primaryServiceName =
    (detailLocale === "nl" && primaryServiceRow?.name_nl) ||
    translateProfessionalService(rawPrimaryServiceName, detailLocale) ||
    rawPrimaryServiceName

  return {
    id: company.id,
    slug: company.slug || company.id,
    name,
    title: detailRow?.title ?? "Professional",
    description: (() => {
      const locale = options?.locale ?? "en"
      const translations = company.translations as Record<string, any> | null
      const localeDesc = translations?.[locale]?.description
      if (localeDesc && typeof localeDesc === "string" && localeDesc.trim()) return localeDesc
      return company.description ?? detailRow?.bio ?? null
    })(),
    bio: detailRow?.bio ?? null,
    location,
    specialties,
    services,
    languages,
    yearsExperience: detailRow?.years_experience ?? null,
    hourlyRateDisplay: formatHourlyRate(detailRow?.hourly_rate_min ?? null, detailRow?.hourly_rate_max ?? null),
    isVerified: Boolean(company.is_verified ?? detailRow?.is_verified),
    isAvailable: Boolean(detailRow?.is_available),
    portfolioUrl: detailRow?.portfolio_url ?? null,
    profile: {
      firstName: profile.first_name ?? null,
      lastName: profile.last_name ?? null,
      avatarUrl: profile.avatar_url ?? null,
      joinedAt: profile.created_at ?? null,
    },
    company: {
      id: company.id,
      name: company.name ?? name,
      description: (() => {
        const loc = options?.locale ?? "en"
        const tr = company.translations as Record<string, any> | null
        const locDesc = tr?.[loc]?.description
        return (locDesc && typeof locDesc === "string" && locDesc.trim()) ? locDesc : (company.description ?? null)
      })(),
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
    gallery,
    socialLinks,
    projects,
  }
}
