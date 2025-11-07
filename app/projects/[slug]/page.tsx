import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"
import { ChevronLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Header } from "@/components/header"
import { ProjectGallery } from "@/components/project-gallery"
import { ProjectInfo } from "@/components/project-info"
import { ProjectActionButtons } from "@/components/project-action-buttons"
import { BreadcrumbWithTooltip } from "@/components/breadcrumb-with-tooltip"
import { ProfessionalsSidebar } from "@/components/professionals-sidebar"
import { ProjectHighlights } from "@/components/project-highlights"
import { ProjectFeatures } from "@/components/project-features"
import { ProfessionalsSection } from "@/components/professionals-section"
import { ProjectDetails } from "@/components/project-details"
import { MapSection } from "@/components/map-section"
import { SimilarProjects } from "@/components/similar-projects"
import { Footer } from "@/components/footer"
import { MobileProfessionalsButton } from "@/components/mobile-professionals-button"
import { ProjectStructuredData } from "@/components/project-structured-data"
import { ProjectPreviewProvider, type ProjectPreviewData } from "@/contexts/project-preview-context"
import { ProjectGalleryModalProvider } from "@/contexts/project-gallery-modal-context"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isProjectRow } from "@/lib/supabase/type-guards"
import { getSiteUrl } from "@/lib/utils"
import type { Tables } from "@/lib/supabase/types"

const PREVIEW_PARAM = "preview"

const isUuid = (value?: string | null): value is string =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const formatDate = (value?: string | null) => {
  if (!value) {
    return null
  }

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value))
  } catch (error) {
    return null
  }
}

const capitalizeStatus = (status: string) => status.replace(/_/g, " ")

const formatEnumLabel = (value: string | null | undefined) => {
  if (!value) {
    return ""
  }

  const normalized = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()

  if (!normalized) {
    return ""
  }

  if (/[A-Z]/.test(normalized)) {
    return normalized
  }

  return normalized
    .split(" ")
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ")
}

const stripHtml = (input: string | null | undefined) =>
  input ? input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null

const sanitizeBreadcrumbLabel = (label: string | null | undefined): string | null => {
  if (!label) {
    return null
  }
  
  // Remove HTML tags and normalize whitespace
  const sanitized = label
    .replace(/<[^>]+>/g, " ") // Remove HTML tags
    .replace(/[<>\"'&]/g, "") // Remove potentially dangerous characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
  
  return sanitized.length > 0 ? sanitized : null
}

async function resolveRedirect(slug: string, supabase: any, visited = new Set<string>()): Promise<string> {
  // Check for circular reference
  if (visited.has(slug)) {
    console.error(`Circular redirect detected in chain: ${Array.from(visited).join(' -> ')} -> ${slug}`)
    // Return the original slug to gracefully handle the error
    return Array.from(visited)[0] || slug
  }
  
  visited.add(slug)
  
  // Prevent infinite chains
  if (visited.size > 10) {
    console.error(`Redirect chain too long: ${Array.from(visited).join(' -> ')}`)
    return Array.from(visited)[0] || slug
  }
  
  const { data, error } = await supabase
    .from('project_redirects')
    .select('new_slug')
    .eq('old_slug', slug)
    .maybeSingle()
  
  if (error) {
    console.error('Error fetching redirect:', error)
    return slug
  }
  
  if (!data?.new_slug) {
    return slug
  }
  
  return resolveRedirect(data.new_slug, supabase, visited)
}

type ProjectRow = Tables<"projects">
type ProjectPhotoRow = Tables<"project_photos">
type ProjectFeatureRow = Tables<"project_features">
type ProjectProfessionalServiceRow = Tables<"project_professional_services">
type ProjectProfessionalRow = Tables<"project_professionals"> & {
  professionals: { id: string; title: string | null } | null
  companies: { id: string; name: string | null; slug: string | null } | null
}
type ProjectCategoryRow = Tables<"project_categories">
type CategoryRow = Tables<"categories">
type TaxonomyOptionRow = Tables<"project_taxonomy_options">
type ProjectSummaryRow = Tables<"mv_project_summary">

type PageProps = {
  params: { slug: string }
  searchParams?: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const supabase = await createServerSupabaseClient()

  // Resolve redirects with recursive chain detection
  const finalSlug = await resolveRedirect(resolvedParams.slug, supabase)
  
  if (finalSlug !== resolvedParams.slug) {
    // Use redirected project metadata
    const { data: redirectedProject } = await supabase
      .from("projects")
      .select("id, title, description, seo_title, seo_description, slug")
      .eq("slug", finalSlug)
      .maybeSingle()

    if (redirectedProject) {
      return await generateProjectMetadata(redirectedProject, supabase)
    }
    // If redirected project not found, fall through to use current slug
  }

  // Get project data for current slug
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, description, seo_title, seo_description, slug")
    .eq("slug", resolvedParams.slug)
    .maybeSingle()

  if (!project) {
    return {
      title: "Project Not Found",
      description: "The requested project could not be found."
    }
  }

  return await generateProjectMetadata(project, supabase)
}

async function generateProjectMetadata(
  project: { id: string; title: string; description?: string | null; seo_title?: string | null; seo_description?: string | null; slug?: string | null },
  supabase: any
): Promise<Metadata> {
  // Get the primary photo for OpenGraph
  const { data: photos } = await supabase
    .from("project_photos")
    .select("url, is_primary")
    .eq("project_id", project.id)
    .order("is_primary", { ascending: false })
    .order("order_index", { ascending: true })
    .limit(3)

  const primaryPhoto = photos?.find(p => p.is_primary) || photos?.[0]

  // Use custom SEO fields if available, otherwise fallback to generated content
  const title = project.seo_title?.trim() || `${project.title} · Arco`
  const description = project.seo_description?.trim() || 
    (project.description ? 
      project.description.replace(/<[^>]*>/g, '').substring(0, 155) + '...' : 
      `Discover ${project.title} on Arco. Browse our curated collection of architectural projects and connect with top professionals.`)

  const baseUrl = getSiteUrl()
  const canonical = project.slug ? `${baseUrl}/projects/${project.slug}` : undefined
  const ogImage = primaryPhoto?.url

  return {
    title,
    description,
    alternates: {
      canonical
    },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      images: ogImage ? [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: project.title,
        }
      ] : undefined,
      siteName: 'Arco'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    }
  }
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams

  const supabase = await createServerSupabaseClient()
  
  // Resolve redirects with recursive chain detection
  const finalSlug = await resolveRedirect(resolvedParams.slug, supabase)
  
  if (finalSlug !== resolvedParams.slug) {
    redirect(`/projects/${finalSlug}`)
  }

  const [{ data: authData }, projectResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("projects")
      .select(
        "id, client_id, title, description, status, project_type, project_type_category_id, building_type, project_size, budget_level, project_year, building_year, style_preferences, address_formatted, address_city, address_region, latitude, longitude, share_exact_location, slug, created_at, updated_at",
      )
      .eq("slug", finalSlug)
      .maybeSingle(),
  ])

  const projectData = projectResult.data

  if (projectResult.error || !isProjectRow(projectData)) {
    notFound()
  }

  const project = projectData

  const previewRequested = Boolean(resolvedSearchParams?.[PREVIEW_PARAM])
  const isPublished = project.status === "published"
  const isListed = project.status === "completed"
  const user = authData?.user ?? null

  let isOwner = false
  let isAdmin = false
  let userHasLiked = false

  if (user) {
    isOwner = project.client_id === user.id

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_types")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.user_types?.includes("admin")) {
      isAdmin = true
    }
  }

  const canPreview = previewRequested && (isOwner || isAdmin)

  if (!(isPublished || isListed) && !canPreview) {
    notFound()
  }

  const canViewInviteDetails = isOwner || isAdmin

  const likeQuery = user
    ? supabase
        .from("project_likes")
        .select("project_id")
        .eq("project_id", project.id)
        .eq("user_id", user.id)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null })

  const [
    photosResult,
    featuresResult,
    taxonomySelectionsResult,
    serviceSelectionsResult,
    projectCategoriesResult,
    invitesResult,
    userLikeResult,
  ] =
    await Promise.all([
      supabase
        .from("project_photos")
        .select("id, url, caption, feature_id, is_primary, order_index")
        .eq("project_id", project.id)
        .order("is_primary", { ascending: false })
        .order("order_index", { ascending: true, nullsFirst: false }),
      supabase
        .from("project_features")
        .select("id, name, description, is_building_default, order_index, category_id, tagline, is_highlighted")
        .eq("project_id", project.id)
        .order("order_index", { ascending: true, nullsFirst: false }),
      supabase
        .from("project_taxonomy_selections")
        .select("taxonomy_option_id")
        .eq("project_id", project.id),
      supabase
        .from("project_professional_services")
        .select("id, service_category_id")
        .eq("project_id", project.id),
      supabase
        .from("project_categories")
        .select("category_id, is_primary")
        .eq("project_id", project.id),
      supabase
        .from("project_professionals")
        .select(`
          id,
          invited_email,
          invited_service_category_id,
          status,
          professional_id,
          company_id,
          professionals(id, title),
          companies!inner(id, name, slug)
        `)
        .eq("project_id", project.id)
        .eq("companies.status", "listed")
        .neq("status", "rejected")
        .not("professional_id", "is", null),
      likeQuery,
    ])

  const primaryQueryErrors = [
    { label: "project photos", error: photosResult.error },
    { label: "project features", error: featuresResult.error },
    { label: "project taxonomy selections", error: taxonomySelectionsResult.error },
    { label: "project professional services", error: serviceSelectionsResult.error },
    { label: "project categories", error: projectCategoriesResult.error },
    { label: "project invites", error: invitesResult.error },
    { label: "project like status", error: userLikeResult.error },
  ].filter((item) => item.error)

  if (primaryQueryErrors.length > 0) {
    primaryQueryErrors.forEach(({ label, error }) => {
      console.error(`Failed to load ${label} for project ${project.id}`, error)
    })
    throw new Error("We couldn't load this project right now. Please try again later.")
  }

  const photos: ProjectPhotoRow[] = photosResult.data ?? []
  const features: ProjectFeatureRow[] = featuresResult.data ?? []
  const taxonomySelections = taxonomySelectionsResult.data ?? []
  const serviceSelections: ProjectProfessionalServiceRow[] = serviceSelectionsResult.data ?? []
  const invites: ProjectProfessionalRow[] = invitesResult.data ?? []
  const projectCategories: ProjectCategoryRow[] = projectCategoriesResult.data ?? []
  userHasLiked = Boolean(userLikeResult.data)

  const categoryIds = new Set<string>()
  const taxonomyIds = new Set<string>()
  const budgetLevels = new Set<string>()

  if (isUuid(project.project_type)) {
    categoryIds.add(project.project_type)
  }

  if (isUuid(project.project_type_category_id)) {
    categoryIds.add(project.project_type_category_id)
  }

  projectCategories.forEach((row) => {
    if (isUuid(row.category_id)) {
      categoryIds.add(row.category_id)
    }
  })

  serviceSelections.forEach((row) => {
    if (isUuid(row.service_category_id)) {
      categoryIds.add(row.service_category_id)
    }
  })

  features.forEach((feature) => {
    if (isUuid(feature.category_id)) {
      categoryIds.add(feature.category_id)
    }
  })

  const primaryStyle = project.style_preferences?.[0]
  if (isUuid(primaryStyle)) {
    taxonomyIds.add(primaryStyle)
  }

  if (isUuid(project.building_type)) {
    taxonomyIds.add(project.building_type)
  }

  if (isUuid(project.project_size)) {
    taxonomyIds.add(project.project_size)
  }

  taxonomySelections.forEach((selection) => {
    if (isUuid(selection.taxonomy_option_id)) {
      taxonomyIds.add(selection.taxonomy_option_id)
    }
  })

  if (project.budget_level) {
    budgetLevels.add(project.budget_level)
  }

  const [categoriesResult, taxonomyResult, budgetOptionsResult] = await Promise.all([
    categoryIds.size
      ? supabase
          .from("categories")
          .select("id, name, slug, parent_id")
          .in("id", Array.from(categoryIds))
      : Promise.resolve({
          data: [] as CategoryRow[],
          error: null,
          status: 200,
          statusText: "OK",
          count: null,
          body: [] as CategoryRow[],
        }),
    taxonomyIds.size
      ? supabase
          .from("project_taxonomy_options")
          .select("id, name, taxonomy_type, slug, icon, metadata")
          .in("id", Array.from(taxonomyIds))
      : Promise.resolve({
          data: [] as TaxonomyOptionRow[],
          error: null,
          status: 200,
          statusText: "OK",
          count: null,
          body: [] as TaxonomyOptionRow[],
        }),
    budgetLevels.size
      ? supabase
          .from("project_taxonomy_options")
          .select("id, name, taxonomy_type, budget_level")
          .eq("taxonomy_type", "budget_tier")
          .in("budget_level", Array.from(budgetLevels))
      : Promise.resolve({
          data: [] as TaxonomyOptionRow[],
          error: null,
          status: 200,
          statusText: "OK",
          count: null,
          body: [] as TaxonomyOptionRow[],
        }),
  ])

  const secondaryQueryErrors = [
    { label: "categories", error: categoriesResult.error },
    { label: "taxonomy options", error: taxonomyResult.error },
    { label: "budget options", error: budgetOptionsResult.error },
  ].filter((item) => item.error)

  if (secondaryQueryErrors.length > 0) {
    secondaryQueryErrors.forEach(({ label, error }) => {
      console.error(`Failed to load ${label} for project ${project.id}`, error)
    })
  }

  const categoryMap = new Map<string, CategoryRow>()
  ;(categoriesResult.data ?? []).forEach((row) => categoryMap.set(row.id, row))

  const taxonomyMap = new Map<string, TaxonomyOptionRow>()
  ;(taxonomyResult.data ?? []).forEach((row) => taxonomyMap.set(row.id, row))

  const budgetLabelMap = new Map<string, string>()
  ;(budgetOptionsResult.data ?? []).forEach((row) => {
    if (row.budget_level) {
      budgetLabelMap.set(row.budget_level, row.name)
    }
  })

  const primaryCategoryRow = projectCategories.find((row) => row.is_primary)
  const primaryCategoryEntity = primaryCategoryRow ? categoryMap.get(primaryCategoryRow.category_id) : null
  const primaryCategoryName = primaryCategoryEntity?.name ?? null
  const primaryCategorySlug = primaryCategoryEntity?.slug ?? null

  const styleLabel = primaryStyle
    ? taxonomyMap.get(primaryStyle)?.name ?? (isUuid(primaryStyle) ? "" : primaryStyle)
    : ""

  const buildingTypeLabel = project.building_type
    ? taxonomyMap.get(project.building_type)?.name ?? (isUuid(project.building_type) ? "" : project.building_type)
    : ""

  const projectSizeLabel = project.project_size
    ? taxonomyMap.get(project.project_size)?.name ?? (isUuid(project.project_size) ? "" : project.project_size)
    : ""

  const projectTypeCategoryId = project.project_type_category_id ?? (isUuid(project.project_type) ? project.project_type : null)
  const projectTypeLabel =
    (projectTypeCategoryId && categoryMap.get(projectTypeCategoryId)?.name) ||
    (project.project_type && !isUuid(project.project_type) ? project.project_type : "")
  const projectTypeId = project.project_type ?? null

  const buildingTypeId = project.building_type ?? null

  const locationLabel = project.address_city ?? ""
  const locationSummaryRaw = locationLabel || project.location || project.address_formatted || null
  const locationSummary = locationSummaryRaw ? locationSummaryRaw.trim() : null
  const canViewExactLocation = (project.share_exact_location ?? false) || isOwner || isAdmin

  const normalizeCoordinate = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) {
      return null
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null
    }

    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  const latitude = normalizeCoordinate(project.latitude)
  const longitude = normalizeCoordinate(project.longitude)

  const coverPhoto = photos.find((photo) => photo.is_primary) ?? (photos.length > 0 ? photos[0] : null)
  const secondaryPhotos = photos.filter((photo) => photo.id !== coverPhoto?.id)

  const photosByFeature = photos.reduce<Map<string, Array<{ id: string; url: string; caption: string | null }>>>((acc, photo) => {
    if (!photo.feature_id) {
      return acc
    }
    if (!acc.has(photo.feature_id)) {
      acc.set(photo.feature_id, [])
    }
    acc.get(photo.feature_id)!.push({ id: photo.id, url: photo.url, caption: photo.caption ?? null })
    return acc
  }, new Map())

  // Get project counts for each company (only published/listed projects)
  const companyIds = invites
    .map(invite => invite.company_id)
    .filter((id): id is string => Boolean(id))

  const [{ data: projectCounts }, { data: companyCoverPhotos }] = await Promise.all([
    companyIds.length > 0
      ? supabase
          .from("project_professionals")
          .select("company_id, project_id, status, projects!inner(status)")
          .in("company_id", companyIds)
          .in("status", ["live_on_page", "listed"])
          .eq("projects.status", "published")
          .not("professional_id", "is", null)
      : Promise.resolve({ data: [] }),
    companyIds.length > 0
      ? supabase
          .from("company_photos")
          .select("company_id, url, is_cover, order_index")
          .in("company_id", companyIds)
          .order("is_cover", { ascending: false })
          .order("order_index", { ascending: true })
      : Promise.resolve({ data: [] })
  ])

  // Count unique projects per company
  const companyProjectCounts = new Map<string, Set<string>>()
  projectCounts?.forEach(row => {
    if (row.company_id && row.project_id) {
      if (!companyProjectCounts.has(row.company_id)) {
        companyProjectCounts.set(row.company_id, new Set())
      }
      companyProjectCounts.get(row.company_id)!.add(row.project_id)
    }
  })

  // Convert to count
  const companyProjectCountsMap = new Map<string, number>()
  companyProjectCounts.forEach((projectSet, companyId) => {
    companyProjectCountsMap.set(companyId, projectSet.size)
  })

  // Map company IDs to their cover photos
  const companyCoverPhotoMap = new Map<string, string>()
  companyCoverPhotos?.forEach(photo => {
    if (photo.company_id && photo.url && !companyCoverPhotoMap.has(photo.company_id)) {
      companyCoverPhotoMap.set(photo.company_id, photo.url)
    }
  })

  // Map project professionals with their company and professional details
  // Note: company_id is the source of truth; companies join data is derived from this FK
  const projectProfessionals = invites.map((invite) => ({
    id: invite.id,
    companyId: invite.company_id,
    professionalId: invite.professional_id,
    serviceCategory: categoryMap.get(invite.invited_service_category_id)?.name ?? "Service",
    serviceCategoryId: invite.invited_service_category_id,
    companyName: invite.companies?.name,
    companySlug: invite.companies?.slug,
    companyLogo: invite.company_id ? companyCoverPhotoMap.get(invite.company_id) ?? null : null,
    professionalTitle: invite.professionals?.title,
    projectsCount: invite.company_id ? (companyProjectCountsMap.get(invite.company_id) || 0) : 0,
    status: invite.status,
  }))

  const descriptionText = stripHtml(project.description)
  const createdAt = formatDate(project.created_at)
  const updatedAt = formatDate(project.updated_at)
  const projectTitle = project.title ?? "Untitled project"

  // Build subtitle from style, sub-type, and location (matching card title format)
  const subtitleParts = []
  if (styleLabel) {
    subtitleParts.push(styleLabel)
  }
  if (projectTypeLabel) {
    subtitleParts.push(projectTypeLabel)
  }
  if (locationLabel) {
    subtitleParts.push(`in ${locationLabel}`)
  }
  const projectSubtitle = subtitleParts.length > 0 ? subtitleParts.join(" ") : null

  // Build third subtitle from building type and project year
  const thirdSubtitleParts = []
  if (buildingTypeLabel) {
    thirdSubtitleParts.push(buildingTypeLabel)
  }
  if (project.project_year) {
    thirdSubtitleParts.push(`in ${project.project_year}`)
  }
  const thirdSubtitle = thirdSubtitleParts.length > 0 ? thirdSubtitleParts.join(" ") : null

  const createProjectsHref = (params?: Record<string, string | null | undefined>) => {
    if (!params) {
      return null
    }

    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (!value) {
        return
      }
      searchParams.set(key, value)
    })

    const query = searchParams.toString()
    return query.length > 0 ? `/projects?${query}` : "/projects"
  }

  const breadcrumbs: ProjectPreviewData["info"]["breadcrumbs"] = []

  const pushBreadcrumb = (label: string | null | undefined, params?: Record<string, string | null | undefined> | null) => {
    if (!label) {
      return
    }
    const href = createProjectsHref(params ?? undefined)
    const entry = { label, href }
    if (!breadcrumbs.some((crumb) => crumb.label === entry.label && crumb.href === entry.href)) {
      breadcrumbs.push(entry)
    }
  }

  pushBreadcrumb("Projects", {})

  // Location breadcrumb
  const locationBreadcrumbLabel = sanitizeBreadcrumbLabel(project.address_city)
  if (locationBreadcrumbLabel) {
    pushBreadcrumb(locationBreadcrumbLabel, { location: locationBreadcrumbLabel })
  }

  // Find parent and child categories for breadcrumbs
  const allProjectCategories = projectCategories.map(row => categoryMap.get(row.category_id)).filter(Boolean)
  const parentCategory = allProjectCategories.find(cat => !cat?.parent_id) // Category without parent
  const childCategory = allProjectCategories.find(cat => cat?.parent_id) // Category with parent

  // Type breadcrumb (parent category like "House")
  const parentCategoryName = sanitizeBreadcrumbLabel(parentCategory?.name)
  if (parentCategoryName && parentCategory) {
    pushBreadcrumb(parentCategoryName, { type: parentCategory.slug ?? parentCategory.id })
  }

  // Sub-Type breadcrumb (child category like "Apartment")
  const childCategoryName = sanitizeBreadcrumbLabel(childCategory?.name)
  if (childCategoryName && childCategory) {
    pushBreadcrumb(childCategoryName, { type: childCategory.slug ?? childCategory.id })
  }

  const budgetLabel = project.budget_level ? budgetLabelMap.get(project.budget_level) ?? formatEnumLabel(project.budget_level) : ""

  const normalizeFeatureName = (name: string) => (name.includes("_") ? formatEnumLabel(name) : name)
  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

  const featurePhotoCounts = new Map<string, number>()
  photosByFeature.forEach((list, featureId) => {
    featurePhotoCounts.set(featureId, list.length)
  })

  const featuresWithPhotos = features.filter((feature) => (featurePhotoCounts.get(feature.id) ?? 0) > 0)

  let heroGroups = featuresWithPhotos.map((feature) => {
    const featurePhotos = photosByFeature.get(feature.id) ?? []
    return {
      feature,
      photos: featurePhotos,
    }
  })
  heroGroups = heroGroups
    .filter(({ photos }) => photos.length > 0)
    .map(({ feature, photos }) => ({
      id: feature.id,
      title: normalizeFeatureName(feature.name),
      description: feature.description ?? feature.tagline,
      photos: photos.map((photo, index) => ({
        id: photo.id,
        url: photo.url,
        alt: photo.caption ?? feature.name,
        isPrimary: index === 0,
      })),
    }))

  if (heroGroups.length === 0 && photos.length > 0) {
    heroGroups = [
      {
        id: "project-gallery",
        title: "Gallery",
        description: null,
        photos: photos.map((photo, index) => ({
          id: photo.id,
          url: photo.url,
          alt: photo.caption ?? "Project photo",
          isPrimary: (photo.is_primary ?? false) || index === 0,
        })),
      },
    ]
  }

  const heroGroupIdSet = new Set(heroGroups.map((group) => group.id))
  const heroGroupBySlug = new Map<string, string>()
  const heroGroupByTitle = new Map<string, string>()

  heroGroups.forEach((group) => {
    heroGroupBySlug.set(slugify(group.title), group.id)
    heroGroupByTitle.set(group.title.trim().toLowerCase(), group.id)
  })

  const resolveModalGroupId = (option: TaxonomyOptionRow) => {
    let resolved: string | null = null

    const metadata = option.metadata as Record<string, unknown> | null | undefined
    if (metadata && typeof metadata === "object") {
      const featureIdValue = (metadata["feature_id"] ?? metadata["featureId"]) as unknown
      const featureId = typeof featureIdValue === "string" ? featureIdValue : null
      if (featureId && heroGroupIdSet.has(featureId)) {
        resolved = featureId
      }

      if (!resolved) {
        const featureSlugValue = (metadata["feature_slug"] ?? metadata["featureSlug"]) as unknown
        const featureSlug = typeof featureSlugValue === "string" ? featureSlugValue : null
        if (featureSlug) {
          resolved = heroGroupBySlug.get(featureSlug) ?? null
        }
      }
    }

    if (!resolved) {
      resolved = heroGroupBySlug.get(option.slug) ?? null
    }

    if (!resolved) {
      resolved = heroGroupByTitle.get(option.name.trim().toLowerCase()) ?? null
    }

    return resolved
  }

  const seenOptionIds = new Set<string>()
  const selectionOptions = taxonomySelections
    .map((selection) => taxonomyMap.get(selection.taxonomy_option_id))
    .filter((option): option is TaxonomyOptionRow => Boolean(option))

  const buildFeatureItems = (type: TaxonomyOptionRow["taxonomy_type"]) => {
    const items: Array<{ id: string; label: string; icon?: string | null; modalGroupId: string }> = []

    selectionOptions.forEach((option) => {
      if (option.taxonomy_type !== type) {
        return
      }
      if (seenOptionIds.has(option.id)) {
        return
      }

      const modalGroupId = resolveModalGroupId(option)
      if (!modalGroupId) {
        return
      }

      seenOptionIds.add(option.id)
      items.push({
        id: option.id,
        label: option.name,
        icon: option.slug ?? null,
        modalGroupId,
      })
    })

    return items
  }

  const locationFeatureItems = buildFeatureItems("location_feature")
  const materialFeatureItems = buildFeatureItems("material_feature")

  // Get materials and location features for metaDetails (without modalGroupId requirement)
  const allMaterialFeatures = selectionOptions
    .filter(option => option.taxonomy_type === "material_feature")
    .map(option => option.name)
  const allLocationFeatures = selectionOptions
    .filter(option => option.taxonomy_type === "location_feature")
    .map(option => option.name)

  const materialsValue = allMaterialFeatures.join(", ")
  const locationFeaturesValue = allLocationFeatures.join(", ")

  // Build metaDetails array - only include non-empty values
  const metaDetails = [
    { label: "Category", value: parentCategory?.name ?? "" }, // Parent category like "Outdoor"
    { label: "Type", value: projectTypeLabel },
    { label: "Style", value: styleLabel },
    { label: "Project type", value: buildingTypeLabel },
    { label: "Size", value: projectSizeLabel },
    { label: "Budget", value: budgetLabel },
    { label: "Project year", value: project.project_year ? String(project.project_year) : "" },
    { label: "Building year", value: project.building_year ? String(project.building_year) : "" },
    { label: "Materials", value: materialsValue },
    { label: "Location", value: locationFeaturesValue },
  ].filter((detail) => detail.value !== null && detail.value !== undefined && detail.value !== "")

  let featureGroups: ProjectPreviewData["featureGroups"] = []

  if (locationFeatureItems.length > 0) {
    featureGroups.push({
      id: "location_features",
      name: "Location features",
      items: locationFeatureItems,
    })
  }

  if (materialFeatureItems.length > 0) {
    featureGroups.push({
      id: "material_features",
      name: "Material features",
      items: materialFeatureItems,
    })
  }

  if (featureGroups.length === 0) {
    const fallbackItems = featuresWithPhotos
      .map((feature) => ({
        id: feature.id,
        label: normalizeFeatureName(feature.name),
        icon: slugify(feature.name),
        modalGroupId: heroGroupIdSet.has(feature.id) ? feature.id : null,
      }))
      .filter((item): item is { id: string; label: string; icon: string | null; modalGroupId: string } =>
        Boolean(item.modalGroupId),
      )

    if (fallbackItems.length > 0) {
      featureGroups = [
        {
          id: "project_features",
          name: "Project features",
          items: fallbackItems,
        },
      ]
    }
  }

  let highlightFeatures = featuresWithPhotos.filter((feature) => feature.is_highlighted)
  if (highlightFeatures.length === 0) {
    highlightFeatures = featuresWithPhotos
  }

  highlightFeatures = highlightFeatures.slice(0, 6)

  const highlights = highlightFeatures.map((feature) => {
    const photo = photosByFeature.get(feature.id)?.[0]
    return {
      id: feature.id,
      title: normalizeFeatureName(feature.name),
      imageUrl: photo?.url ?? coverPhoto?.url ?? "/placeholder.svg?height=200&width=300",
      description: feature.tagline ?? feature.description,
    }
  })

  const professionalsSummary = projectProfessionals.slice(0, 3)

  const SIMILAR_LIMIT = 6
  const similarProjects: ProjectPreviewData["similarProjects"] = []
  const seenSimilarIds = new Set<string>()

  const similarFilters: Array<{
    primaryCategorySlug?: string | null
    projectTypeId?: string | null
    buildingTypeId?: string | null
  }> = []

  if (primaryCategorySlug && projectTypeId) {
    similarFilters.push({ primaryCategorySlug, projectTypeId })
  }

  if (primaryCategorySlug && buildingTypeId) {
    similarFilters.push({ primaryCategorySlug, buildingTypeId })
  }

  if (primaryCategorySlug) {
    similarFilters.push({ primaryCategorySlug })
  }

  if (projectTypeId) {
    similarFilters.push({ projectTypeId })
  }

  if (buildingTypeId) {
    similarFilters.push({ buildingTypeId })
  }

  // Collect similar projects data first
  const similarProjectsData: ProjectSummaryRow[] = []
  for (const filter of similarFilters) {
    const remaining = SIMILAR_LIMIT - similarProjectsData.length
    if (remaining <= 0) {
      break
    }

    const { primaryCategorySlug: primarySlug, projectTypeId: typeId, buildingTypeId: buildId } = filter
    if (!primarySlug && !typeId && !buildId) {
      continue
    }

    let query = supabase
      .from("mv_project_summary")
      .select(
        "id, slug, title, location, likes_count, primary_photo_url, project_type, primary_category, building_type, created_at, style_preferences",
      )
      .neq("id", project.id)
      .eq("status", "published")

    if (primarySlug) {
      query = query.eq("primary_category_slug", primarySlug)
    }

    if (typeId) {
      query = query.eq("project_type", typeId)
    }

    if (buildId) {
      query = query.eq("building_type", buildId)
    }

    const { data, error: similarError } = await query
      .order("likes_count", { ascending: false, nullsLast: false })
      .order("created_at", { ascending: false, nullsLast: false })
      .limit(remaining)

    if (similarError) {
      console.error("Failed to load similar projects", { projectId: project.id, filter, error: similarError })
      continue
    }

    const rows: ProjectSummaryRow[] = data ?? []
    rows.forEach((row) => {
      if (!row.id || seenSimilarIds.has(row.id) || !row.slug) {
        return
      }
      seenSimilarIds.add(row.id)
      similarProjectsData.push(row)
    })

    if (similarProjectsData.length >= SIMILAR_LIMIT) {
      break
    }
  }

  // Collect all taxonomy and category IDs from similar projects
  const similarTaxonomyIds = new Set<string>()
  const similarCategoryIds = new Set<string>()

  similarProjectsData.forEach((row) => {
    const primaryStyle = row.style_preferences?.[0]
    if (isUuid(primaryStyle)) {
      similarTaxonomyIds.add(primaryStyle)
    }
    if (isUuid(row.project_type)) {
      similarCategoryIds.add(row.project_type)
    }
  })

  // Fetch taxonomy and category data for similar projects
  const [similarTaxonomyResult, similarCategoriesResult] = await Promise.all([
    similarTaxonomyIds.size
      ? supabase
          .from("project_taxonomy_options")
          .select("id, name, taxonomy_type, slug")
          .in("id", Array.from(similarTaxonomyIds))
      : Promise.resolve({ data: [] as TaxonomyOptionRow[], error: null }),
    similarCategoryIds.size
      ? supabase
          .from("categories")
          .select("id, name, slug")
          .in("id", Array.from(similarCategoryIds))
      : Promise.resolve({ data: [] as CategoryRow[], error: null }),
  ])

  const similarTaxonomyMap = new Map<string, TaxonomyOptionRow>()
  ;(similarTaxonomyResult.data ?? []).forEach((row) => similarTaxonomyMap.set(row.id, row))

  const similarCategoryMap = new Map<string, CategoryRow>()
  ;(similarCategoriesResult.data ?? []).forEach((row) => similarCategoryMap.set(row.id, row))

  // Now build the formatted similar projects
  similarProjectsData.forEach((row) => {
    const titleParts = []
    const primaryStyle = row.style_preferences?.[0]
    if (primaryStyle) {
      const styleLabel = similarTaxonomyMap.get(primaryStyle)?.name || primaryStyle
      titleParts.push(styleLabel)
    }
    if (row.project_type) {
      const subTypeLabel = similarCategoryMap.get(row.project_type)?.name || row.project_type
      titleParts.push(subTypeLabel)
    }
    if (row.location) {
      titleParts.push(`in ${row.location}`)
    }
    const formattedTitle = titleParts.length > 0 ? titleParts.join(" ") : (row.title ?? "Untitled project")

    similarProjects.push({
      id: row.id,
      title: formattedTitle,
      slug: row.slug,
      imageUrl: row.primary_photo_url,
      likes: row.likes_count ?? 0,
      href: row.slug ? `/projects/${row.slug}` : null,
    })
  })

  const previewData: ProjectPreviewData = {
    projectId: project.id,
    slug: project.slug ?? resolvedParams.slug,
    likesCount: project.likes_count ?? 0,
    isLiked: userHasLiked,
    hero: {
      coverPhoto: coverPhoto
        ? {
            id: coverPhoto.id,
            url: coverPhoto.url,
            alt: coverPhoto.caption ?? "Project cover",
            isPrimary: true,
          }
        : null,
      secondaryPhotos: secondaryPhotos.map((photo) => ({
        id: photo.id,
        url: photo.url,
        alt: photo.caption ?? "Project photo",
        isPrimary: photo.is_primary ?? false,
      })),
      groups: heroGroups,
    },
    canViewInviteDetails,
    info: {
      breadcrumbs,
      title: projectTitle,
      subtitle: projectSubtitle,
      sponsoredLabel: thirdSubtitle,
      descriptionHtml: project.description,
      descriptionPlain: descriptionText,
    },
    statusBadge: capitalizeStatus(project.status),
    locationLabel,
    metaDetails,
    highlights,
    featureGroups,
    projectProfessionals,
    professionalsSummary,
    location: {
      city: project.address_city,
      region: project.address_region,
      shareExact: project.share_exact_location ?? false,
      canViewExact: canViewExactLocation,
      latitude: canViewExactLocation ? latitude : null,
      longitude: canViewExactLocation ? longitude : null,
      addressFormatted: canViewExactLocation ? project.address_formatted : null,
      summary: locationSummary,
    },
    similarProjects,
    shareImageUrl: coverPhoto?.url ?? null,
    shareUrl: `/projects/${project.slug}`,
  }

  return (
    <ProjectPreviewProvider value={previewData}>
      <ProjectGalleryModalProvider>
        <ProjectStructuredData
          project={{
            id: project.id,
            title: project.title,
            description: project.description,
            slug: project.slug,
            createdAt: project.created_at,
            location: {
              city: project.address_city,
              region: project.address_region,
              summary: locationSummary
            }
          }}
          coverPhotoUrl={coverPhoto?.url}
          professionals={professionalsSummary}
        />
        <div className="min-h-screen bg-white">
          {canPreview && <PreviewBanner />}

          <Header maxWidth="max-w-7xl" />

          <main className="px-4 py-8 md:px-8 pt-20 md:pt-20">
            <div className="max-w-7xl mx-auto">
            {/* Back Button and Action Buttons */}
            <div className="flex flex-row items-center justify-between mb-4 gap-3 md:gap-4 mt-4">
              <Button variant="tertiary" size="tertiary" asChild className="w-20 min-w-[5rem] max-w-[5rem]">
                <Link href="/projects">
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Link>
              </Button>

              <div>
                <ProjectActionButtons projectId={project.id} />
              </div>
            </div>

            <div className="mb-8">
              <ProjectGallery />
            </div>

            {/* Breadcrumb Row */}
            <div className="mb-2">
              <BreadcrumbWithTooltip items={breadcrumbs} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 py-4">
              <div className="lg:col-span-2 space-y-8">
                <ProjectInfo />
                <ProjectHighlights />
                <ProjectFeatures />
                <ProfessionalsSection />
                <ProjectDetails />
                <MapSection />
              </div>

              <div className="hidden lg:block lg:col-span-1">
                <ProfessionalsSidebar />
              </div>
            </div>
            </div>
          </main>

          <div className="w-full bg-white">
            <div className="px-4 md:px-8">
              <div className="max-w-7xl mx-auto">
                <SimilarProjects />
              </div>
            </div>
          </div>

          <Footer maxWidth="max-w-7xl" />
          
          <MobileProfessionalsButton />
        </div>
      </ProjectGalleryModalProvider>
    </ProjectPreviewProvider>
  )
}

function PreviewBanner() {
  return (
    <div className="bg-amber-500/10 py-3 text-sm text-amber-900">
      <div className="mx-auto flex max-w-6xl items-center justify-center px-4">
        <p className="font-medium">
          You&rsquo;re viewing a private preview. Only you and the Arco review team can see this page until the project is
          published.
        </p>
      </div>
    </div>
  )
}

export { PREVIEW_PARAM }
