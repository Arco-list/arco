import { notFound, redirect } from "next/navigation"
import { getProjectTranslation } from "@/lib/project-translations"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SubNav } from "@/components/project/sub-nav"
import { ProjectHero } from "@/components/project/project-hero"
import { ProjectHeader } from "@/components/project/project-header"
import { SpecificationsBar } from "@/components/project/specifications-bar"
import { PhotoTour } from "@/components/project/photo-tour"
import { CreditedProfessionals } from "@/components/project/credited-professionals"
import { ProjectCTA } from "@/components/project/project-cta"
import { RelatedProjects } from "@/components/project/related-projects"
import { ProjectStructuredData } from "@/components/project-structured-data"
import { TrackProjectView } from "@/components/track-view"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isProjectRow } from "@/lib/supabase/type-guards"
import { getSiteUrl } from "@/lib/utils"
import { SPACES, SPACE_SLUGS } from "@/lib/spaces"

const PREVIEW_PARAM = "preview"

const isUuid = (value?: string | null): value is string =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

async function resolveRedirect(slug: string, supabase: any, visited = new Set<string>()): Promise<string> {
  if (visited.has(slug)) {
    console.error(`Circular redirect detected: ${Array.from(visited).join(' -> ')} -> ${slug}`)
    return Array.from(visited)[0] || slug
  }

  visited.add(slug)

  if (visited.size > 10) {
    console.error(`Redirect chain too long: ${Array.from(visited).join(' -> ')}`)
    return Array.from(visited)[0] || slug
  }

  const { data, error } = await supabase
    .from('project_redirects')
    .select('new_slug')
    .eq('old_slug', slug)
    .maybeSingle()

  if (error || !data?.new_slug) {
    return slug
  }

  return resolveRedirect(data.new_slug, supabase, visited)
}

type PageProps = {
  params: { slug: string; locale: string }
  searchParams?: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const supabase = await createServerSupabaseClient()

  const finalSlug = await resolveRedirect(resolvedParams.slug, supabase)

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, description, translations, seo_title, seo_description, slug")
    .eq("slug", finalSlug)
    .maybeSingle()

  if (!project) {
    const t = await getTranslations("project_detail")
    return {
      title: t("not_found_title"),
      description: t("not_found_description")
    }
  }

  const { data: photos } = await supabase
    .from("project_photos")
    .select("url, is_primary")
    .eq("project_id", project.id)
    .order("is_primary", { ascending: false })
    .limit(1)

  const primaryPhoto = photos?.[0]
  const metaLocale = resolvedParams.locale ?? "en"
  const localizedMetaTitle = getProjectTranslation(project, "title", metaLocale) || project.title
  const localizedMetaDesc = getProjectTranslation(project, "description", metaLocale) || project.description
  const title = project.seo_title?.trim() || `${localizedMetaTitle} · Arco`
  const description = project.seo_description?.trim() ||
    (localizedMetaDesc ?
      localizedMetaDesc.replace(/<[^>]*>/g, '').substring(0, 155) + '...' :
      `Discover ${localizedMetaTitle} on Arco`)

  const baseUrl = getSiteUrl()
  const canonical = project.slug ? `${baseUrl}/projects/${project.slug}` : undefined

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      images: primaryPhoto?.url ? [{
        url: primaryPhoto.url,
        width: 1200,
        height: 630,
        alt: project.title,
      }] : undefined,
    }
  }
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const t = await getTranslations("project_detail")
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const supabase = await createServerSupabaseClient()

  // Resolve redirects
  const finalSlug = await resolveRedirect(resolvedParams.slug, supabase)
  if (finalSlug !== resolvedParams.slug) {
    redirect(`/projects/${finalSlug}`)
  }

  // Fetch project (try slug first, then ID for admin preview)
  const [{ data: authData }, projectResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("projects")
      .select("*")
      .eq("slug", finalSlug)
      .maybeSingle(),
  ])

  let project = projectResult.data

  // If not found by slug, try by ID (for admin preview of projects without a slug)
  if (!project && isUuid(finalSlug)) {
    const { data: projectById } = await supabase
      .from("projects")
      .select("*")
      .eq("id", finalSlug)
      .maybeSingle()
    project = projectById
  }

  if (!project || !isProjectRow(project)) {
    notFound()
  }

  // Locale-aware title and description
  const locale = resolvedParams.locale ?? "en"
  const localizedTitle = getProjectTranslation(project, "title", locale) || project.title
  const localizedDescription = getProjectTranslation(project, "description", locale) || project.description

  // Check permissions
  const previewRequested = Boolean(resolvedSearchParams?.[PREVIEW_PARAM])
  const isPublished = project.status === "published"
  const user = authData?.user ?? null
  const isOwner = user && project.client_id === user.id

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_types")
      .eq("id", user.id)
      .maybeSingle()
    isAdmin = profile?.user_types?.includes("admin") || false
  }

  const canPreview = previewRequested && (isOwner || isAdmin)
  if (!isPublished && !canPreview) {
    notFound()
  }

  // Fetch related data
  const [photosResult, professionalsResult, featuresResult] = await Promise.all([
    supabase
      .from("project_photos")
      .select("id, url, caption, feature_id, is_primary, order_index")
      .eq("project_id", project.id)
      .order("is_primary", { ascending: false })
      .order("order_index", { ascending: true }),
    (() => {
      let q = supabase
        .from("project_professionals")
        .select(`
          id,
          invited_service_category_ids,
          status,
          professional_id,
          company_id,
          is_project_owner,
          companies!inner(id, name, slug, status, logo_url, primary_service_id, services_offered)
        `)
        .eq("project_id", project.id)
        .not("company_id", "is", null)
      if (canPreview) {
        // In preview mode, show listed/featured professionals + the project owner
        q = q.or("status.in.(live_on_page,listed),is_project_owner.eq.true")
      } else {
        q = q.in("status", ["live_on_page", "listed"]).neq("companies.status", "unlisted")
      }
      return q
    })(),
    supabase
      .from("project_features")
      .select("id, space:spaces!space_id(slug)")
      .eq("project_id", project.id)
      .not("space_id", "is", null)
  ])

  const photos = photosResult.data ?? []
  const professionals = professionalsResult.data ?? []

  // Build feature_id → space slug map
  const featureSpaceMap = new Map<string, string>()
  for (const f of featuresResult.data ?? []) {
    const slug = (f.space as any)?.slug
    if (slug) featureSpaceMap.set(f.id, slug)
  }

  // Enrich photos with space slug and collect unique spaces
  const spaceOrderMap = new Map(SPACE_SLUGS.map((slug, idx) => [slug, idx]))
  const enrichedPhotos = photos
    .map(p => ({
      ...p,
      space: p.feature_id ? featureSpaceMap.get(p.feature_id) ?? null : null,
    }))
    .sort((a, b) => {
      const orderA = a.space ? (spaceOrderMap.get(a.space) ?? 999) : 999
      const orderB = b.space ? (spaceOrderMap.get(b.space) ?? 999) : 999
      if (orderA !== orderB) return orderA - orderB
      return (a.order_index ?? 0) - (b.order_index ?? 0)
    })
  const spaceSet = new Set(
    enrichedPhotos.map(p => p.space).filter((s): s is string => Boolean(s))
  )
  // Order by SPACES constant (matches spaces table sort_order)
  const uniqueSpaces = SPACES.filter(s => spaceSet.has(s.slug)).map(s => s.slug)
  // When there are tagged spaces, assign untagged photos to "other" so they group under the Other pill
  const hasUntagged = enrichedPhotos.some(p => !p.space)
  if (uniqueSpaces.length > 0 && hasUntagged) {
    uniqueSpaces.push("other")
    for (const p of enrichedPhotos) {
      if (!p.space) p.space = "other"
    }
  }

  // Get categories for professionals
  const categoryIds = Array.from(new Set(
    professionals.flatMap(p => {
      const invited = (p.invited_service_category_ids as string[] | null) ?? []
      if (invited.length > 0) return invited
      // Include company's primary service or first services_offered as fallback
      const company = p.companies as any
      if (company?.primary_service_id) return [company.primary_service_id]
      if (company?.services_offered?.length) return [company.services_offered[0]]
      return []
    })
  ))

  const { data: categories } = categoryIds.length > 0
    ? await supabase
        .from("categories")
        .select("id, name, sort_order")
        .in("id", categoryIds)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true })
    : { data: [] }

  const categoryMap = new Map(categories?.map(c => [c.id, c.name]) ?? [])
  // sort_order map for ordering services like the admin table
  const categorySortOrder = new Map(categories?.map((c, i) => [c.id, i]) ?? [])

  // Get company project counts and photos
  const companyIds = professionals
    .map(p => p.company_id)
    .filter((id): id is string => Boolean(id))

  const [{ data: projectCounts }, { data: companyPhotos }] = await Promise.all([
    companyIds.length > 0
      ? supabase
          .from("project_professionals")
          .select("company_id, project_id, projects!inner(status)")
          .in("company_id", companyIds)
          .eq("projects.status", "published")
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

  // Get company logos
  const companyLogoMap = new Map<string, string>()
  companyPhotos?.forEach(photo => {
    if (photo.company_id && photo.url && !companyLogoMap.has(photo.company_id)) {
      companyLogoMap.set(photo.company_id, photo.url)
    }
  })

  // Format professionals data for components — project owner first
  const formattedProfessionals = professionals
    .sort((a, b) => {
      // Owner always first
      const aOwner = a.is_project_owner ? 1 : 0
      const bOwner = b.is_project_owner ? 1 : 0
      if (aOwner !== bOwner) return bOwner - aOwner
      // Then sort by primary service order
      const aServices = (a.invited_service_category_ids as string[] | null) ?? []
      const bServices = (b.invited_service_category_ids as string[] | null) ?? []
      const aOrder = Math.min(...aServices.map(id => categorySortOrder.get(id) ?? 999), 999)
      const bOrder = Math.min(...bServices.map(id => categorySortOrder.get(id) ?? 999), 999)
      return aOrder - bOrder
    })
    .map(p => {
      let serviceIds = (p.invited_service_category_ids as string[] | null) ?? []
      // Fall back to company's primary service or services_offered if no invited services set
      if (serviceIds.length === 0) {
        const company = p.companies as any
        if (company?.primary_service_id) {
          serviceIds = [company.primary_service_id]
        } else if (company?.services_offered?.length) {
          serviceIds = [company.services_offered[0]]
        }
      }
      const serviceCategories = serviceIds
        .slice()
        .sort((a, b) => (categorySortOrder.get(a) ?? 999) - (categorySortOrder.get(b) ?? 999))
        .map(sid => categoryMap.get(sid))
        .filter((name): name is string => Boolean(name))
      return {
        id: p.id,
        companyId: p.company_id,
        companyName: p.companies?.name ?? t("unknown"),
        companySlug: (p.companies as any)?.slug,
        serviceCategory: serviceCategories.length > 0 ? serviceCategories.join(" · ") : t("service"),
        serviceCategories,
        logo: p.companies?.logo_url ?? (p.company_id ? companyLogoMap.get(p.company_id) ?? null : null),
        projectsCount: p.company_id ? (companyProjectCounts.get(p.company_id)?.size ?? 0) : 0,
      }
    })

  // Format for ProjectStructuredData (different format)
  const structuredDataProfessionals = formattedProfessionals.map(p => ({
    name: p.companyName,
    badge: p.serviceCategory,
  }))

  // Get architect for related projects
  const architect = formattedProfessionals.find(p =>
    p.serviceCategory.toLowerCase().includes('architect')
  )

  // Fetch related projects (only if architect has a company)
  const { data: relatedProjects } = architect?.companyId
    ? await supabase
        .from("project_professionals")
        .select(`
          project_id,
          projects!inner(
            id,
            slug,
            title,
            address_city,
            project_year,
            project_type_category_id
          )
        `)
        .eq("company_id", architect.companyId)
        .eq("projects.status", "published")
        .neq("project_id", project.id)
        .limit(3)
    : { data: [] }

  // Get related project photos
  const relatedProjectIds = relatedProjects?.map(r => r.project_id).filter(Boolean) ?? []
  const { data: relatedPhotos } = relatedProjectIds.length > 0
    ? await supabase
        .from("project_photos")
        .select("project_id, url, is_primary")
        .in("project_id", relatedProjectIds)
        .order("is_primary", { ascending: false })
        .limit(relatedProjectIds.length)
    : { data: [] }

  const relatedPhotoMap = new Map(
    relatedPhotos?.map(p => [p.project_id, p.url]) ?? []
  )

  const coverPhoto = photos.find(p => p.is_primary) ?? photos[0]

  // Resolve UUIDs → human-readable names
  // Type: edit page saves to project_type_category_id (UUID → categories table)
  // Scope: edit page saves to project_type (plain string like "New Build")
  // Style: stored as UUID in style_preferences → project_taxonomy_options table
  const typeId = project.project_type_category_id
  const styleIds = (Array.isArray(project.style_preferences) ? project.style_preferences : []).filter(isUuid)

  const relatedCategoryIds = (relatedProjects ?? [])
    .map(r => r.projects.project_type_category_id)
    .filter(isUuid)

  const uuidsToResolve = {
    categories: [...[typeId].filter(isUuid), ...relatedCategoryIds],
    taxonomy: styleIds,
  }

  const [{ data: resolvedCategories }, { data: resolvedTaxonomy }] = await Promise.all([
    uuidsToResolve.categories.length > 0
      ? supabase.from("categories").select("id, name").in("id", uuidsToResolve.categories)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    uuidsToResolve.taxonomy.length > 0
      ? supabase.from("project_taxonomy_options").select("id, name").in("id", uuidsToResolve.taxonomy)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const nameMap = new Map<string, string>()
  for (const row of resolvedCategories ?? []) nameMap.set(row.id, row.name)
  for (const row of resolvedTaxonomy ?? []) nameMap.set(row.id, row.name)

  const resolveName = (value: string | null | undefined): string | null => {
    if (!value) return null
    if (isUuid(value)) return nameMap.get(value) ?? null
    return value
  }

  const formattedRelatedProjects = relatedProjects?.map(r => ({
    id: r.projects.id,
    slug: r.projects.slug,
    title: r.projects.title,
    location: r.projects.address_city,
    projectType: resolveName(r.projects.project_type_category_id) ?? null,
    imageUrl: relatedPhotoMap.get(r.project_id) ?? null,
  })) ?? []

  // Type from project_type_category_id, falling back to project_type if it's a UUID
  const resolvedType = resolveName(typeId) ?? resolveName(project.project_type)
  // Scope from project_type (plain string like "New Build", "Renovation", "Interior Design")
  const SCOPE_VALUES = ["New Build", "Renovation", "Interior Design"]
  const resolvedScope = SCOPE_VALUES.includes(project.project_type ?? "") ? project.project_type : null
  const resolvedStyle = resolveName(
    Array.isArray(project.style_preferences) ? project.style_preferences[0] : null
  )

  return (
    <>
      <TrackProjectView projectId={project.id} slug={project.slug ?? finalSlug} />
      <ProjectStructuredData
        project={{
          id: project.id,
          title: localizedTitle,
          description: localizedDescription,
          slug: project.slug,
          createdAt: project.created_at,
          location: {
            city: project.address_city,
            region: project.address_region,
            summary: project.address_city
          }
        }}
        coverPhotoUrl={coverPhoto?.url}
        professionals={structuredDataProfessionals}
      />

      <div className="min-h-screen bg-white">
        <Header />

        <ProjectHero imageUrl={coverPhoto?.url ?? null} alt={localizedTitle} />

        <SubNav projectId={project.id} title={localizedTitle} subtitle={[resolvedType, project.address_city].filter(Boolean).join(" · ")} imageUrl={coverPhoto?.url ?? null} slug={project.slug} />

        {/*
          ── Details section ───────────────────────────────────────────────────
          id="details" is the scroll target for the SubNav "Details" link.
          It wraps ProjectHeader + SpecificationsBar only.
          PhotoTour lives in its own section below so #photo-tour scrolls
          independently.
        */}
        <div id="details" className="wrap" style={{ marginTop: '60px' }}>
          <ProjectHeader
            title={localizedTitle}
            architectName={architect?.companyName ?? null}
            architectSlug={architect?.companySlug ?? null}
            description={localizedDescription}
          />

          <SpecificationsBar
            location={project.address_city}
            year={project.project_year}
            type={resolvedType}
            scope={resolvedScope}
            style={resolvedStyle}
          />
        </div>

        {/*
          ── Photos section ────────────────────────────────────────────────────
          PhotoTour already renders its own id="photo-tour" wrapper internally.
          The outer .wrap provides consistent horizontal padding.
        */}
        <div className="wrap" style={{ marginBottom: '60px' }}>
          <PhotoTour photos={enrichedPhotos} projectId={project.id} spaces={uniqueSpaces} />
        </div>

        <CreditedProfessionals professionals={formattedProfessionals} />

        <ProjectCTA />

        {formattedRelatedProjects.length > 0 && (
          <RelatedProjects
            projects={formattedRelatedProjects}
            architectName={architect?.companyName ?? t("this_architect")}
          />
        )}

        <Footer />
      </div>
    </>
  )
}
