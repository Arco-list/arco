import { notFound, redirect } from "next/navigation"
import { canonicalizeScope, getProjectTranslation, translateCategoryName, translateProjectStyle, translateScope } from "@/lib/project-translations"
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
import { RelatedProjects } from "@/components/project/related-projects"
import { SimilarProjects } from "@/components/project/similar-projects"
import { ProjectStructuredData } from "@/components/project-structured-data"
import { TrackProjectView } from "@/components/track-view"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isProjectRow } from "@/lib/supabase/type-guards"
import { getSiteUrl } from "@/lib/utils"
import { SPACES, SPACE_SLUGS } from "@/lib/spaces"
import { locales } from "@/i18n/config"

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
      title: { absolute: t("not_found_title") },
      description: t("not_found_description")
    }
  }

  const metaLocale = resolvedParams.locale ?? "en"
  const localizedMetaTitle = getProjectTranslation(project, "title", metaLocale) || project.title
  const localizedMetaDesc = getProjectTranslation(project, "description", metaLocale) || project.description

  // Append the project-owner credit ("by Marco van Veldhuizen" / "door …") to
  // the page title. The owner is the company on the project_professionals row
  // with is_project_owner = true — same source the JSON-LD `author` field uses,
  // so structured data and the visible title always match. seo_title is an
  // admin-set override; when it's present, it wins as-is — no auto-credit.
  let ownerName: string | null = null
  const { data: ownerRow } = await supabase
    .from("project_professionals")
    .select("companies(name)")
    .eq("project_id", project.id)
    .eq("is_project_owner", true)
    .maybeSingle()
  ownerName = ((ownerRow as { companies?: { name?: string | null } | null } | null)?.companies?.name) ?? null
  const byLabel = metaLocale === "nl" ? "door" : "by"
  const titleBase = project.seo_title?.trim() || localizedMetaTitle
  const title = !project.seo_title?.trim() && ownerName
    ? `${titleBase} ${byLabel} ${ownerName}`
    : titleBase

  const description = project.seo_description?.trim() ||
    (localizedMetaDesc ?
      localizedMetaDesc.replace(/<[^>]*>/g, '').substring(0, 155) + '...' :
      `Discover ${localizedMetaTitle} on Arco`)

  const baseUrl = getSiteUrl()
  const canonical = project.slug ? `${baseUrl}/projects/${project.slug}` : undefined
  const languages = project.slug
    ? Object.fromEntries(
        locales.map((l) => [l, `${baseUrl}/${l}/projects/${project.slug}`])
      )
    : undefined

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical,
      ...(languages
        ? { languages: { ...languages, "x-default": canonical } }
        : {}),
    },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      // og:image is provided by opengraph-image.tsx co-located with this
      // route — omit `images` here so Next.js doesn't emit two <meta
      // property="og:image"> tags.
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
  const [photosResult, professionalsResult, featuresResult, photographerResult] = await Promise.all([
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
          companies!inner(id, name, slug, status, logo_url, primary_service_id, services_offered, audience)
        `)
        .eq("project_id", project.id)
        .not("company_id", "is", null)
        // Photographers (audience='pro') are surfaced via the dedicated
        // spec-bar credit (see photographerResult below). Hide them from
        // the Credited professionals section so they don't double up.
        .neq("companies.audience", "pro")
      if (canPreview) {
        // In preview mode, show listed/featured professionals + the project owner
        q = q.or("status.in.(live_on_page,listed),is_project_owner.eq.true")
      } else {
        q = q.in("status", ["live_on_page", "listed"]).neq("companies.status", "unlisted").neq("companies.status", "unclaimed")
      }
      return q
    })(),
    supabase
      .from("project_features")
      .select("id, space:spaces!space_id(slug)")
      .eq("project_id", project.id)
      .not("space_id", "is", null),
    // Photographer credit. Separate from the main professionals query because
    // photographers should appear in the specs bar regardless of company
    // status — unclaimed photographers still get a name shown (plain text);
    // only once their company is `listed` does the name become a link to
    // /photographers/[slug]. Filtering on companies.audience = 'pro' picks
    // them out without binding to the photographer category UUID.
    supabase
      .from("project_professionals")
      .select(`
        id,
        company_id,
        companies!inner(id, name, slug, status, audience)
      `)
      .eq("project_id", project.id)
      .eq("companies.audience", "pro")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
  ])

  const photos = photosResult.data ?? []
  const professionals = professionalsResult.data ?? []

  // Block access if the project owner's company has "unclaimed" status (not yet visible)
  if (!canPreview) {
    const ownerPro = professionals.find((p: any) => p.is_project_owner)
    const ownerCompanyStatus = (ownerPro?.companies as any)?.status
    if (ownerCompanyStatus === "unclaimed") {
      notFound()
    }
  }

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
        companySlug: (p.companies as any)?.slug ?? null,
        serviceCategory: serviceCategories.length > 0 ? serviceCategories.join(" · ") : t("service"),
        serviceCategories,
        logo: p.companies?.logo_url ?? (p.company_id ? companyLogoMap.get(p.company_id) ?? null : null),
        projectsCount: p.company_id ? (companyProjectCounts.get(p.company_id)?.size ?? 0) : 0,
        isProjectOwner: Boolean(p.is_project_owner),
      }
    })

  // Build structured-data inputs: split owner from contributors. The owner
  // becomes the JSON-LD `author`; everyone else becomes a `contributor` with
  // `roleName` from their primary service category.
  const structuredOwner = formattedProfessionals.find((p) => p.isProjectOwner) ?? null
  const structuredContributors = formattedProfessionals
    .filter((p) => !p.isProjectOwner)
    .map((p) => ({
      companySlug: p.companySlug,
      companyName: p.companyName,
      roleName: p.serviceCategories[0] ?? null,
    }))

  // The "more from this owner" rail uses the actual project owner
  // (is_project_owner = true), not a string-match for "architect" — earlier
  // we matched the first credit whose category contained "architect", which
  // silently broke the rail for any project owned by an interior designer
  // or contractor. The cross-architect "Similar projects" section below
  // covers cross-studio discovery.
  const projectOwner =
    formattedProfessionals.find((p) => p.isProjectOwner) ?? formattedProfessionals[0]

  // "More from this owner": up to 6 other published projects from the same owning company.
  const { data: relatedProjects } = projectOwner?.companyId
    ? await supabase
        .from("project_professionals")
        .select(`
          project_id,
          projects!inner(
            id,
            slug,
            title,
            translations,
            address_city,
            project_year,
            project_type_category_id
          )
        `)
        .eq("company_id", projectOwner.companyId)
        .eq("projects.status", "published")
        .neq("project_id", project.id)
        .limit(6)
    : { data: [] }

  // "Similar projects from other studios": same building type when known,
  // same country, by a *different* owning company. Cap at 6 and dedupe
  // against relatedProjects so we never show the same project in both rails.
  const sameOwnerProjectIds = new Set(
    (relatedProjects ?? []).map((r: any) => r.project_id).filter(Boolean) as string[],
  )
  const excludeProjectIds = [project.id, ...sameOwnerProjectIds]
  const similarBuildingType = project.project_type_category_id
  const similarCountry = project.address_country
  let similarProjects: Array<{
    id: string
    slug: string | null
    title: string
    translations: Record<string, any> | null
    address_city: string | null
    project_type_category_id: string | null
  }> = []
  if (similarBuildingType || similarCountry) {
    let q = supabase
      .from("projects")
      .select("id, slug, title, translations, address_city, project_type_category_id")
      .eq("status", "published")
      .not("slug", "is", null)
      .not("id", "in", `(${excludeProjectIds.join(",")})`)
      .limit(12) // overshoot — we'll filter to non-same-owner in JS and slice to 6
    if (similarBuildingType) q = q.eq("project_type_category_id", similarBuildingType)
    if (similarCountry) q = q.eq("address_country", similarCountry)
    const { data } = await q
    similarProjects = (data ?? []) as typeof similarProjects
  }

  // Filter out projects belonging to the same owning company (so this rail
  // is purely cross-studio). We need each candidate's owner company_id.
  const similarCandidateIds = similarProjects.map((p) => p.id)
  const ownerByProjectId = new Map<string, string | null>()
  if (similarCandidateIds.length > 0) {
    const { data: owners } = await supabase
      .from("project_professionals")
      .select("project_id, company_id")
      .in("project_id", similarCandidateIds)
      .eq("is_project_owner", true)
    for (const row of owners ?? []) {
      if (row.project_id) ownerByProjectId.set(row.project_id, row.company_id ?? null)
    }
  }
  similarProjects = similarProjects
    .filter((p) => ownerByProjectId.get(p.id) !== projectOwner?.companyId)
    .slice(0, 3)

  // Get cover photos for both rails in one query
  const relatedProjectIds = relatedProjects?.map((r) => r.project_id).filter(Boolean) ?? []
  const similarProjectIds = similarProjects.map((p) => p.id)
  const allRailIds = Array.from(new Set([...relatedProjectIds, ...similarProjectIds])).filter(Boolean) as string[]
  const { data: railPhotos } = allRailIds.length > 0
    ? await supabase
        .from("project_photos")
        .select("project_id, url, is_primary, order_index")
        .in("project_id", allRailIds)
        .order("is_primary", { ascending: false })
        .order("order_index", { ascending: true })
    : { data: [] }

  // First photo per project_id wins (already sorted by is_primary desc, order_index asc)
  const relatedPhotoMap = new Map<string, string>()
  for (const p of railPhotos ?? []) {
    if (p.project_id && p.url && !relatedPhotoMap.has(p.project_id)) {
      relatedPhotoMap.set(p.project_id, p.url)
    }
  }

  const coverPhoto = photos.find(p => p.is_primary) ?? photos[0]

  // Resolve UUIDs → human-readable names
  // Type: edit page saves to project_type_category_id (UUID → categories table)
  // Scope: edit page saves to project_type (plain string like "New Build")
  // Style: stored as UUID in style_preferences → project_taxonomy_options table
  const typeId = project.project_type_category_id
  const styleIds = (Array.isArray(project.style_preferences) ? project.style_preferences : []).filter(isUuid)

  const relatedCategoryIds = (relatedProjects ?? [])
    .map((r) => r.projects.project_type_category_id)
    .filter(isUuid)
  const similarCategoryIds = similarProjects
    .map((p) => p.project_type_category_id)
    .filter(isUuid)

  const uuidsToResolve = {
    categories: [...[typeId].filter(isUuid), ...relatedCategoryIds, ...similarCategoryIds],
    taxonomy: styleIds,
  }

  const [{ data: resolvedCategories }, { data: resolvedTaxonomy }] = await Promise.all([
    uuidsToResolve.categories.length > 0
      ? supabase.from("categories").select("id, name, slug").in("id", uuidsToResolve.categories)
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string | null }[] }),
    uuidsToResolve.taxonomy.length > 0
      ? supabase.from("project_taxonomy_options").select("id, name, slug, taxonomy_type").in("id", uuidsToResolve.taxonomy)
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string | null; taxonomy_type: string | null }[] }),
  ])

  // Prefer the slug so translateCategoryName / translateProjectStyle can
  // resolve a Dutch label; fall back to the English name when the slug
  // isn't in our curated translation map.
  const nameMap = new Map<string, string>()
  for (const row of resolvedCategories ?? []) {
    const translated = translateCategoryName(row.slug ?? row.name, locale)
    nameMap.set(row.id, translated ?? row.name)
  }
  for (const row of resolvedTaxonomy ?? []) {
    const translated = row.taxonomy_type === "project_style"
      ? translateProjectStyle(row.slug ?? row.name, locale)
      : null
    nameMap.set(row.id, translated ?? row.name)
  }

  const resolveName = (value: string | null | undefined): string | null => {
    if (!value) return null
    if (isUuid(value)) return nameMap.get(value) ?? null
    // Non-UUID value stored directly on project.project_type — e.g. historical
    // "Extension" / "Villa" display strings. Try the category translator first
    // so NL visitors see a translated label; otherwise pass through.
    return translateCategoryName(value, locale) ?? value
  }

  const formattedRelatedProjects = relatedProjects?.map((r) => ({
    id: r.projects.id,
    slug: r.projects.slug,
    title:
      getProjectTranslation(
        { title: r.projects.title, translations: (r.projects as any).translations },
        "title",
        locale,
      ) || r.projects.title,
    location: r.projects.address_city,
    projectType: resolveName(r.projects.project_type_category_id) ?? null,
    imageUrl: relatedPhotoMap.get(r.project_id) ?? null,
  })) ?? []

  const formattedSimilarProjects = similarProjects.map((p) => ({
    id: p.id,
    slug: p.slug,
    title:
      getProjectTranslation(
        { title: p.title, translations: p.translations },
        "title",
        locale,
      ) || p.title,
    location: p.address_city,
    projectType: resolveName(p.project_type_category_id) ?? null,
    imageUrl: relatedPhotoMap.get(p.id) ?? null,
  }))

  // Photographer credit for the specs bar. isLive controls whether the name
  // links to /photographers/[slug] (only once the company is fully listed) or
  // renders as plain text.
  const photographerCompany = (photographerResult?.data as any)?.companies ?? null
  const photographerCredit = photographerCompany
    ? {
        name: photographerCompany.name as string,
        slug: (photographerCompany.slug as string | null) ?? null,
        isLive: photographerCompany.status === "listed",
      }
    : null

  // Type from project_type_category_id, falling back to project_type if it's a UUID
  const resolvedType = resolveName(typeId) ?? resolveName(project.project_type)
  // Scope from project_type — canonicalise to a slug so SpecificationsBar
  // can render a locale-aware label (lib/project-translations.ts).
  // canonicalizeScope accepts either the display string currently in DB or
  // the canonical slug, so this works without a data migration.
  const resolvedScope = canonicalizeScope(project.project_type)
  const rawStyle = Array.isArray(project.style_preferences) ? project.style_preferences[0] : null
  const resolvedStyle = rawStyle && isUuid(rawStyle)
    ? nameMap.get(rawStyle) ?? null
    : translateProjectStyle(rawStyle, locale) ?? rawStyle

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
          updatedAt: project.updated_at,
          locale,
          type: resolvedType,
          // Structured data (JSON-LD) stays in English for SEO — Google's
          // knowledge graph indexes English-first. Feed the English label,
          // not the canonical slug.
          scope: translateScope(resolvedScope, "en"),
          style: resolvedStyle,
          location: {
            city: project.address_city,
            region: project.address_region,
            country: project.address_country,
            latitude: project.latitude,
            longitude: project.longitude,
            shareExactLocation: project.share_exact_location,
          },
        }}
        imageUrls={enrichedPhotos.map((p) => p.url).filter(Boolean) as string[]}
        owner={
          structuredOwner
            ? {
                companySlug: structuredOwner.companySlug,
                companyName: structuredOwner.companyName,
                roleName: structuredOwner.serviceCategories[0] ?? null,
              }
            : null
        }
        contributors={structuredContributors}
        relatedProjects={formattedRelatedProjects.map((rp) => ({
          slug: rp.slug,
          title: rp.title,
        }))}
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
            architectName={projectOwner?.companyName ?? null}
            architectSlug={projectOwner?.companySlug ?? null}
            description={localizedDescription}
          />

          <SpecificationsBar
            location={project.address_city}
            year={project.project_year}
            type={resolvedType}
            scope={resolvedScope}
            style={resolvedStyle}
            photographer={photographerCredit}
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

        {formattedRelatedProjects.length > 0 && (
          <RelatedProjects
            projects={formattedRelatedProjects}
            architectName={projectOwner?.companyName ?? t("this_architect")}
          />
        )}

        {formattedSimilarProjects.length > 0 && (
          <SimilarProjects projects={formattedSimilarProjects} />
        )}

        <Footer />
      </div>
    </>
  )
}
