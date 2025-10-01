import { notFound } from "next/navigation"

import { Header } from "@/components/header"
import { ProjectGallery } from "@/components/project-gallery"
import { ProjectInfo } from "@/components/project-info"
import { ProfessionalsSidebar } from "@/components/professionals-sidebar"
import { ProjectHighlights } from "@/components/project-highlights"
import { ProjectFeatures } from "@/components/project-features"
import { ProfessionalsSection } from "@/components/professionals-section"
import { ProjectDetails } from "@/components/project-details"
import { MapSection } from "@/components/map-section"
import { SimilarProjects } from "@/components/similar-projects"
import { Footer } from "@/components/footer"
import { ProjectPreviewProvider, type ProjectPreviewData } from "@/contexts/project-preview-context"
import { createServerSupabaseClient } from "@/lib/supabase/server"
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

const stripHtml = (input: string | null | undefined) =>
  input ? input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null

type ProjectRow = Tables<"projects">
type ProjectPhotoRow = Tables<"project_photos">
type ProjectFeatureRow = Tables<"project_features">
type ProjectProfessionalServiceRow = Tables<"project_professional_services">
type ProjectProfessionalRow = Tables<"project_professionals">
type ProjectCategoryRow = Tables<"project_categories">
type CategoryRow = Tables<"categories">
type TaxonomyOptionRow = Tables<"project_taxonomy_options">
type ProjectSummaryRow = Tables<"mv_project_summary">

type PageProps = {
  params: { slug: string }
  searchParams?: { [key: string]: string | string[] | undefined }
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const supabase = await createServerSupabaseClient()
  const [{ data: authData }, projectResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("projects")
      .select(
        "id, client_id, title, description, status, project_type, building_type, project_size, budget_level, project_year, building_year, style_preferences, address_city, address_region, share_exact_location, slug, created_at, updated_at",
      )
      .eq("slug", params.slug)
      .maybeSingle(),
  ])

  const project = projectResult.data as ProjectRow | null

  if (projectResult.error || !project) {
    notFound()
  }

  const previewRequested = Boolean(searchParams?.[PREVIEW_PARAM])
  const isPublished = project.status === "published"
  const user = authData?.user ?? null

  let isOwner = false
  let isAdmin = false

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

  if (!isPublished && !canPreview) {
    notFound()
  }

  const [photosResult, featuresResult, serviceSelectionsResult, projectCategoriesResult, invitesResult] =
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
        .from("project_professional_services")
        .select("id, service_category_id")
        .eq("project_id", project.id),
      supabase
        .from("project_categories")
        .select("category_id, is_primary")
        .eq("project_id", project.id),
      supabase
        .from("project_professionals")
        .select("id, invited_email, invited_service_category_id, status")
        .eq("project_id", project.id),
    ])

  const photos = (photosResult.data ?? []) as ProjectPhotoRow[]
  const features = (featuresResult.data ?? []) as ProjectFeatureRow[]
  const serviceSelections = (serviceSelectionsResult.data ?? []) as ProjectProfessionalServiceRow[]
  const invites = (invitesResult.data ?? []) as ProjectProfessionalRow[]
  const projectCategories = (projectCategoriesResult.data ?? []) as ProjectCategoryRow[]

  const categoryIds = new Set<string>()
  const taxonomyIds = new Set<string>()

  if (isUuid(project.project_type)) {
    categoryIds.add(project.project_type)
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

  const [categoriesResult, taxonomyResult] = await Promise.all([
    categoryIds.size
      ? supabase
          .from("categories")
          .select("id, name, slug, parent_id")
          .in("id", Array.from(categoryIds))
      : Promise.resolve({ data: [] as CategoryRow[], error: null }),
    taxonomyIds.size
      ? supabase
          .from("project_taxonomy_options")
          .select("id, name, taxonomy_type")
          .in("id", Array.from(taxonomyIds))
      : Promise.resolve({ data: [] as TaxonomyOptionRow[], error: null }),
  ])

  const categoryMap = new Map<string, CategoryRow>()
  ;(categoriesResult.data ?? []).forEach((row) => categoryMap.set(row.id, row))

  const taxonomyMap = new Map<string, TaxonomyOptionRow>()
  ;(taxonomyResult.data ?? []).forEach((row) => taxonomyMap.set(row.id, row))

  const primaryCategoryRow = projectCategories.find((row) => row.is_primary)
  const primaryCategoryName =
    (primaryCategoryRow && categoryMap.get(primaryCategoryRow.category_id)?.name) || null

  const secondaryCategoryName = projectCategories
    .filter((row) => !row.is_primary)
    .map((row) => categoryMap.get(row.category_id)?.name)
    .filter((value): value is string => Boolean(value))
    .join(", ")

  const styleLabel = primaryStyle
    ? taxonomyMap.get(primaryStyle)?.name ?? (isUuid(primaryStyle) ? "" : primaryStyle)
    : ""

  const buildingTypeLabel = project.building_type
    ? taxonomyMap.get(project.building_type)?.name ?? (isUuid(project.building_type) ? "" : project.building_type)
    : ""

  const projectSizeLabel = project.project_size
    ? taxonomyMap.get(project.project_size)?.name ?? (isUuid(project.project_size) ? "" : project.project_size)
    : ""

  const projectTypeLabel = project.project_type
    ? categoryMap.get(project.project_type)?.name ?? (isUuid(project.project_type) ? "" : project.project_type)
    : ""

  const locationLabel = [project.address_city, project.address_region].filter(Boolean).join(", ")

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

  const servicePreviews = serviceSelections.map((selection) => {
    const name =
      categoryMap.get(selection.service_category_id)?.name ??
      (isUuid(selection.service_category_id) ? "Unnamed service" : selection.service_category_id)

    const relatedInvites = invites
      .filter((invite) => invite.invited_service_category_id === selection.service_category_id)
      .map((invite) => ({
        id: invite.id,
        email: invite.invited_email,
        status: capitalizeStatus(invite.status),
      }))

    return {
      id: selection.service_category_id,
      name,
      invites: relatedInvites,
    }
  })

  const descriptionText = stripHtml(project.description)
  const createdAt = formatDate(project.created_at)
  const updatedAt = formatDate(project.updated_at)

  const breadcrumbs = ["Projects"]
  if (primaryCategoryName) {
    breadcrumbs.push(primaryCategoryName)
  }

  if (secondaryCategoryName) {
    secondaryCategoryName
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => {
        if (!breadcrumbs.includes(value)) {
          breadcrumbs.push(value)
        }
      })
  }

  if (projectTypeLabel && !breadcrumbs.includes(projectTypeLabel)) {
    breadcrumbs.push(projectTypeLabel)
  }

  const metaDetails = [
    { label: "Category", value: primaryCategoryName ?? "" },
    { label: "Project type", value: projectTypeLabel },
    { label: "Style", value: styleLabel },
    { label: "Building type", value: buildingTypeLabel },
    { label: "Project size", value: projectSizeLabel },
    { label: "Budget", value: project.budget_level ?? "" },
    { label: "Project year", value: project.project_year ? String(project.project_year) : "" },
    { label: "Building year", value: project.building_year ? String(project.building_year) : "" },
    { label: "Photos", value: photos.length ? String(photos.length) : "" },
    { label: "Created", value: createdAt ?? "" },
    { label: "Updated", value: updatedAt ?? "" },
  ].filter((detail) => detail.value !== null && detail.value !== undefined && detail.value !== "")

  const featureGroupsMap = new Map<string, { id: string; name: string; items: Array<{ id: string; label: string }> }>()

  features.forEach((feature) => {
    const groupId = feature.category_id ?? (feature.is_building_default ? "building-default" : "additional")
    const fallbackName = feature.is_building_default ? "Building" : "Additional"
    const name = feature.category_id
      ? categoryMap.get(feature.category_id)?.name ?? fallbackName
      : fallbackName

    if (!featureGroupsMap.has(groupId)) {
      featureGroupsMap.set(groupId, {
        id: groupId,
        name,
        items: [],
      })
    }

    featureGroupsMap.get(groupId)!.items.push({ id: feature.id, label: feature.name })
  })

  const featureGroups = Array.from(featureGroupsMap.values()).filter((group) => group.items.length > 0)

  const highlightFeatures = features
    .filter((feature) => feature.is_highlighted || (photosByFeature.get(feature.id)?.length ?? 0) > 0)
    .slice(0, 6)

  const highlights = highlightFeatures.map((feature) => {
    const photo = photosByFeature.get(feature.id)?.[0]
    return {
      id: feature.id,
      title: feature.name,
      imageUrl: photo?.url ?? coverPhoto?.url ?? "/placeholder.svg?height=200&width=300",
      description: feature.tagline ?? feature.description,
    }
  })

  const heroGroups = features
    .map((feature) => ({ feature, photos: photosByFeature.get(feature.id) ?? [] }))
    .filter(({ photos }) => photos.length > 0)
    .map(({ feature, photos }) => ({
      id: feature.id,
      title: feature.name,
      description: feature.description ?? feature.tagline,
      photos: photos.map((photo, index) => ({
        id: photo.id,
        url: photo.url,
        alt: photo.caption ?? feature.name,
        isPrimary: index === 0,
      })),
    }))

  const professionalServices = servicePreviews.map((service) => ({
    id: service.id,
    name: service.name,
    invites: service.invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      status: invite.status,
    })),
  }))

  const professionalsSummary = professionalServices
    .flatMap((service) =>
      service.invites.map((invite) => ({
        id: `${service.id}-${invite.id}`,
        name: invite.email,
        badge: service.name,
      })),
    )
    .slice(0, 3)

  const SIMILAR_LIMIT = 6
  const similarProjects: ProjectPreviewData["similarProjects"] = []
  const seenSimilarIds = new Set<string>()

  const similarFilters: Array<{
    primaryCategory?: string | null
    projectType?: string | null
    buildingType?: string | null
  }> = []

  if (primaryCategoryName && projectTypeLabel) {
    similarFilters.push({ primaryCategory: primaryCategoryName, projectType: projectTypeLabel })
  }

  if (primaryCategoryName && buildingTypeLabel) {
    similarFilters.push({ primaryCategory: primaryCategoryName, buildingType: buildingTypeLabel })
  }

  if (primaryCategoryName) {
    similarFilters.push({ primaryCategory: primaryCategoryName })
  }

  if (projectTypeLabel) {
    similarFilters.push({ projectType: projectTypeLabel })
  }

  for (const filter of similarFilters) {
    const remaining = SIMILAR_LIMIT - similarProjects.length
    if (remaining <= 0) {
      break
    }

    const { primaryCategory, projectType, buildingType } = filter
    if (!primaryCategory && !projectType && !buildingType) {
      continue
    }

    let query = supabase
      .from("mv_project_summary")
      .select(
        "id, slug, title, location, likes_count, primary_photo_url, project_type, primary_category, building_type, created_at",
      )
      .neq("id", project.id)
      .eq("status", "published")

    if (primaryCategory) {
      query = query.eq("primary_category", primaryCategory)
    }

    if (projectType) {
      query = query.eq("project_type", projectType)
    }

    if (buildingType) {
      query = query.eq("building_type", buildingType)
    }

    const { data } = await query
      .order("likes_count", { ascending: false, nullsLast: false })
      .order("created_at", { ascending: false, nullsLast: false })
      .limit(remaining)

    ;(data as ProjectSummaryRow[] | null)?.forEach((row) => {
      if (!row.id || seenSimilarIds.has(row.id) || !row.slug) {
        return
      }

      seenSimilarIds.add(row.id)
      similarProjects.push({
        id: row.id,
        title: row.title ?? "Untitled project",
        location: row.location,
        imageUrl: row.primary_photo_url,
        likes: row.likes_count ?? undefined,
        href: row.slug ? `/projects/${row.slug}` : null,
      })
    })

    if (similarProjects.length >= SIMILAR_LIMIT) {
      break
    }
  }

  const previewData: ProjectPreviewData = {
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
    info: {
      breadcrumbs,
      title: project.title ?? "Untitled project",
      subtitle: [styleLabel, projectTypeLabel].filter(Boolean).join(" • ") || null,
      sponsoredLabel: project.project_year ? `Sponsored in ${project.project_year}` : null,
      descriptionHtml: project.description,
      descriptionPlain: descriptionText,
    },
    statusBadge: capitalizeStatus(project.status),
    locationLabel,
    metaDetails,
    highlights,
    featureGroups,
    professionalServices,
    professionalsSummary,
    location: {
      city: project.address_city,
      region: project.address_region,
      shareExact: project.share_exact_location ?? false,
    },
    similarProjects,
    shareImageUrl: coverPhoto?.url ?? null,
    shareUrl: `/projects/${project.slug}`,
  }

  return (
    <ProjectPreviewProvider value={previewData}>
      <div className="min-h-screen bg-white">
        {canPreview && <PreviewBanner />}

        <Header />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:px-0">
          <div className="mb-8">
            <ProjectGallery />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start py-8">
            <div className="lg:col-span-2 space-y-8">
              <ProjectInfo />
              <ProjectHighlights />
              <ProjectFeatures />
              <ProfessionalsSection />
              <ProjectDetails />
              <MapSection />
            </div>

            <div className="lg:col-span-1">
              <ProfessionalsSidebar />
            </div>
          </div>
        </main>

        <div className="w-full bg-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-[0]">
            <SimilarProjects />
          </div>
        </div>

        <Footer />
      </div>
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
