import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"

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
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isProjectRow } from "@/lib/supabase/type-guards"
import { getSiteUrl } from "@/lib/utils"

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
  params: { slug: string }
  searchParams?: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const supabase = await createServerSupabaseClient()

  const finalSlug = await resolveRedirect(resolvedParams.slug, supabase)
  
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, description, seo_title, seo_description, slug")
    .eq("slug", finalSlug)
    .maybeSingle()

  if (!project) {
    return {
      title: "Project Not Found",
      description: "The requested project could not be found."
    }
  }

  const { data: photos } = await supabase
    .from("project_photos")
    .select("url, is_primary")
    .eq("project_id", project.id)
    .order("is_primary", { ascending: false })
    .limit(1)

  const primaryPhoto = photos?.[0]
  const title = project.seo_title?.trim() || `${project.title} · Arco`
  const description = project.seo_description?.trim() || 
    (project.description ? 
      project.description.replace(/<[^>]*>/g, '').substring(0, 155) + '...' : 
      `Discover ${project.title} on Arco.`)

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
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const supabase = await createServerSupabaseClient()
  
  // Resolve redirects
  const finalSlug = await resolveRedirect(resolvedParams.slug, supabase)
  if (finalSlug !== resolvedParams.slug) {
    redirect(`/projects/${finalSlug}`)
  }

  // Fetch project
  const [{ data: authData }, projectResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("projects")
      .select("*")
      .eq("slug", finalSlug)
      .maybeSingle(),
  ])

  const project = projectResult.data

  if (projectResult.error || !isProjectRow(project)) {
    notFound()
  }

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
  const [photosResult, professionalsResult] = await Promise.all([
    supabase
      .from("project_photos")
      .select("id, url, caption, feature_id, is_primary, order_index")
      .eq("project_id", project.id)
      .order("is_primary", { ascending: false })
      .order("order_index", { ascending: true }),
    supabase
      .from("project_professionals")
      .select(`
        id,
        invited_service_category_id,
        status,
        professional_id,
        company_id,
        companies!inner(id, name, slug, status)
      `)
      .eq("project_id", project.id)
      .in("status", ["live_on_page", "listed"])
      .not("professional_id", "is", null)
  ])

  const photos = photosResult.data ?? []
  const professionals = professionalsResult.data ?? []

  // Get categories for professionals
  const categoryIds = professionals
    .map(p => p.invited_service_category_id)
    .filter((id): id is string => Boolean(id))

  const { data: categories } = categoryIds.length > 0
    ? await supabase
        .from("categories")
        .select("id, name")
        .in("id", categoryIds)
    : { data: [] }

  const categoryMap = new Map(categories?.map(c => [c.id, c.name]) ?? [])

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

  // Format professionals data for components
  const formattedProfessionals = professionals.map(p => ({
    id: p.id,
    companyId: p.company_id,
    companyName: p.companies?.name ?? "Unknown",
    companySlug: p.companies?.slug,
    serviceCategory: categoryMap.get(p.invited_service_category_id ?? '') ?? "Service",
    logo: p.company_id ? companyLogoMap.get(p.company_id) ?? null : null,
    projectsCount: p.company_id ? (companyProjectCounts.get(p.company_id)?.size ?? 0) : 0,
  }))

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
            project_year
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

  const formattedRelatedProjects = relatedProjects?.map(r => ({
    id: r.projects.id,
    slug: r.projects.slug,
    title: r.projects.title,
    location: r.projects.address_city,
    year: r.projects.project_year,
    imageUrl: relatedPhotoMap.get(r.project_id) ?? null,
  })) ?? []

  const coverPhoto = photos.find(p => p.is_primary) ?? photos[0]

  return (
    <>
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
            summary: project.address_city
          }
        }}
        coverPhotoUrl={coverPhoto?.url}
        professionals={structuredDataProfessionals}
      />

      <div className="min-h-screen bg-white">
        <Header />
        
        <ProjectHero imageUrl={coverPhoto?.url ?? null} alt={project.title} />
        
        <SubNav />

        {/* UPDATED: Use .wrap instead of .project-container for consistent padding */}
        <div className="wrap" style={{ marginTop: '60px', marginBottom: '60px' }}>
          <ProjectHeader
            title={project.title}
            architectName={architect?.companyName ?? null}
            architectSlug={architect?.companySlug ?? null}
            description={project.description}
          />

          <SpecificationsBar
            location={project.address_city}
            year={project.project_year}
            type={project.project_type}
            scope={project.building_type}
            style={project.style_preferences?.[0] ?? null}
          />

          <PhotoTour photos={photos} projectId={project.id} />
        </div>

        <CreditedProfessionals professionals={formattedProfessionals} />

        <ProjectCTA />

        {formattedRelatedProjects.length > 0 && (
          <RelatedProjects
            projects={formattedRelatedProjects}
            architectName={architect?.companyName ?? "this architect"}
          />
        )}

        <Footer />
      </div>
    </>
  )
}
