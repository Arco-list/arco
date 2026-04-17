// app/page.tsx
// Updated to use .wrap class for consistent horizontal margins

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import type { Database, Tables } from "@/lib/supabase/types"
import { Header } from "@/components/header"
import { HeroSection, type HeroProject } from "@/components/hero-section"
import { BrowseSection, type BrowseCard } from "@/components/browse-section"
import { RecentProjects, type RecentProject } from "@/components/recent-projects"
import { FeaturesSection } from "@/components/features-section"
import { MembershipCTA } from "@/components/membership-cta"
import { FeaturedCompanies, type FeaturedCompany } from "@/components/featured-companies"
import { Footer } from "@/components/footer"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { getLocalizedName } from "@/lib/locale-name"
import { getProjectTranslation, translateCategoryName } from "@/lib/project-translations"
import { TrackPageView } from "@/components/track-view"

export const revalidate = 300

type SearchProjectsRow = Database["public"]["Functions"]["search_projects"]["Returns"][number]

type CategoryRow = Tables<"categories"> & {
  project_category_attributes?: Pick<Tables<"project_category_attributes">, "is_listable"> | null
}

type CategoryWithChildren = CategoryRow & {
  children: CategoryRow[]
}

const PLACEHOLDER_IMAGE = "/placeholder.svg?height=300&width=300"

const normalizeSlug = (value: string | null | undefined) =>
  (value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const FALLBACK_HERO_PROJECTS: HeroProject[] = [
  {
    id: "fallback-1",
    title: "Exceptional Architecture. Trusted Professionals.",
    href: "/projects",
    imageUrl: "/placeholder.svg?height=1080&width=1920",
    caption: "Modern Villa in Amsterdam",
  },
  {
    id: "fallback-2",
    title: "Exceptional Architecture. Trusted Professionals.",
    href: "/projects",
    imageUrl: "/placeholder.svg?height=1080&width=1920",
    caption: "Contemporary Residence in Rotterdam",
  },
  {
    id: "fallback-3",
    title: "Exceptional Architecture. Trusted Professionals.",
    href: "/projects",
    imageUrl: "/placeholder.svg?height=1080&width=1920",
    caption: "Luxury Estate in Utrecht",
  },
]

async function loadLandingData(locale: string) {
  const supabase = await createServerSupabaseClient()

  const [
    heroCoversResult,
    popularProjectsResult,
    parentCategoriesResult,
    homeProjectTypesResult,
    homeProfessionalServicesResult,
    featuredCompaniesResult,
  ] = await Promise.all([
    supabase
      .from("hero_covers")
      .select("slot, project_id, photo_url, projects(id, title, slug, location, project_type, translations)")
      .eq("scope", "home")
      .order("slot", { ascending: true }),
    supabase.rpc("search_projects", { limit_count: 12, featured_only: true }),
    supabase
      .from("categories")
      .select("id,name,name_nl,slug,parent_id,sort_order,project_category_attributes(is_listable)")
      .eq("is_active", true)
      .is("parent_id", null)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    // Homepage carousel: child project types flagged for homepage (exclude groups)
    supabase
      .from("categories")
      .select("id,name,name_nl,slug,parent_id,sort_order,image_url")
      .eq("is_active", true)
      .eq("in_home_carrousel", true)
      .eq("category_type", "Project")
      .eq("category_hierarchy", 2)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })
      .limit(5),
    // Homepage carousel: child professional services flagged for homepage (exclude groups)
    supabase
      .from("categories")
      .select("id,name,name_nl,slug,parent_id,sort_order,image_url")
      .eq("is_active", true)
      .eq("in_home_carrousel", true)
      .eq("category_type", "Professional")
      .eq("category_hierarchy", 2)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })
      .limit(5),
    supabase
      .from("companies")
      .select(`
        id,
        name,
        slug,
        city,
        country,
        logo_url,
        hero_photo_url,
        primary_service_id,
        primary_service:categories!companies_primary_service_id_fkey(name, name_nl)
      `)
      .eq("is_featured", true)
      .in("status", ["listed", "prospected"]),
  ])

  if (heroCoversResult.error) logger.error("Failed to load hero covers", { scope: "landing" }, heroCoversResult.error)
  if (popularProjectsResult.error) logger.error("Failed to load popular projects", { scope: "landing" }, popularProjectsResult.error)
  if (parentCategoriesResult.error) logger.error("Failed to load project categories", { scope: "landing" }, parentCategoriesResult.error)
  if (homeProjectTypesResult.error) logger.error("Failed to load home project types", { scope: "landing" }, homeProjectTypesResult.error)
  if (homeProfessionalServicesResult.error) logger.error("Failed to load home professional services", { scope: "landing" }, homeProfessionalServicesResult.error)
  if (featuredCompaniesResult.error) logger.error("Failed to load featured companies", { scope: "landing" }, featuredCompaniesResult.error)

  // Build hero projects from hero_covers table.
  // Title is resolved locale-aware from projects.translations with fallback
  // to the base title column.
  const heroCovers = (heroCoversResult.data ?? []) as any[]
  const heroProjects = heroCovers
    .filter((cover) => cover.projects?.slug)
    .map((cover) => ({
      id: cover.projects.id,
      title:
        getProjectTranslation(
          { title: cover.projects.title, translations: cover.projects.translations },
          "title",
          locale,
        ) || cover.projects.title || "Untitled",
      slug: cover.projects.slug,
      location: cover.projects.location,
      project_type: cover.projects.project_type,
      primary_photo_url: cover.photo_url,
    }))
  const popularProjects = (popularProjectsResult.data ?? []).filter((project) => Boolean(project?.slug))
  const parentCategories = (parentCategoriesResult.data as CategoryRow[] | null) ?? []
  const homeProjectTypes = (homeProjectTypesResult.data as Tables<"categories">[] | null) ?? []
  const homeProfessionalServices = (homeProfessionalServicesResult.data as Tables<"categories">[] | null) ?? []
  // Shuffle featured companies and take 3 for rotation on each request
  const allFeaturedCompanies = featuredCompaniesResult.data ?? []
  const shuffled = [...allFeaturedCompanies].sort(() => Math.random() - 0.5)
  const featuredCompaniesRaw = shuffled.slice(0, 3)

  let childCategories: CategoryRow[] = []

  if (parentCategories.length > 0) {
    const parentIds = parentCategories.map((category) => category.id)
    const childCategoriesResult = await supabase
      .from("categories")
      .select("id,name,name_nl,slug,parent_id,sort_order,project_category_attributes(is_listable)")
      .eq("is_active", true)
      .in("parent_id", parentIds)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })

    if (childCategoriesResult.error) {
      logger.error("Failed to load project subcategories", { scope: "landing" }, childCategoriesResult.error)
    } else {
      childCategories = (childCategoriesResult.data as CategoryRow[] | null) ?? []
    }
  }

  const childrenByParentId = new Map<string, CategoryRow[]>()
  childCategories.forEach((child) => {
    if (!child.parent_id) return
    const existing = childrenByParentId.get(child.parent_id) ?? []
    childrenByParentId.set(child.parent_id, [...existing, child])
  })

  childrenByParentId.forEach((list, key) => {
    childrenByParentId.set(
      key,
      list.sort((a, b) => {
        const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0)
        if (orderDiff !== 0) return orderDiff
        return (a.name ?? "").localeCompare(b.name ?? "")
      }),
    )
  })

  const projectCategoriesRaw: CategoryWithChildren[] = parentCategories.map((category) => ({
    ...category,
    children: childrenByParentId.get(category.id) ?? [],
  }))

  const parentSlugByChildSlug = new Map<string, string>()
  projectCategoriesRaw.forEach((category) => {
    const parentSlug = normalizeSlug(category.slug) || normalizeSlug(category.name)
    if (!parentSlug) return
    ;(category.children ?? []).forEach((child) => {
      const childSlug = normalizeSlug(child.slug) || normalizeSlug(child.name)
      if (!childSlug) return
      parentSlugByChildSlug.set(childSlug, parentSlug)
    })
  })

  const listableChildCategories = projectCategoriesRaw
    .flatMap((category) => category.children ?? [])
    .filter((child) => child?.project_category_attributes?.is_listable)
    .slice(0, 24)
    .filter(Boolean) as (Tables<"categories"> & {
    project_category_attributes?: Pick<Tables<"project_category_attributes">, "is_listable"> | null
  })[]

  // Include homepage project types in representative image lookup
  const homeProjectTypeIds = homeProjectTypes.map((c) => c.id)
  const uniqueCategoryIdsForImages = Array.from(new Set([
    ...listableChildCategories.map((child) => child.id),
    ...homeProjectTypeIds,
  ]))

  const representativeProjectResults = await Promise.all(
    uniqueCategoryIdsForImages.map((categoryId) =>
      supabase.rpc("search_projects", { category_filter: categoryId, limit_count: 1 }),
    ),
  )

  const representativeProjectMap = new Map<string, SearchProjectsRow | undefined>()
  representativeProjectResults.forEach((result, index) => {
    if (result.error) {
      logger.error("Failed to load representative project", { scope: "landing", categoryId: uniqueCategoryIdsForImages[index] }, result.error)
      return
    }
    const project = result.data?.[0]
    const categoryId = uniqueCategoryIdsForImages[index]
    if (categoryId) representativeProjectMap.set(categoryId, project)
  })

  // Get project counts per category
  const categoryCountsResult = await supabase
    .from("project_categories")
    .select("category_id")
  
  const categoryCounts = new Map<string, number>()
  if (!categoryCountsResult.error && categoryCountsResult.data) {
    categoryCountsResult.data.forEach((pc) => {
      const count = categoryCounts.get(pc.category_id) ?? 0
      categoryCounts.set(pc.category_id, count + 1)
    })
  }

  // BrowseSection data - Projects: use homepage-flagged child project types
  const browseProjects: BrowseCard[] = homeProjectTypes.map((category) => {
    const typeSlug = normalizeSlug(category.slug) || normalizeSlug(category.name)
    const projectCount = categoryCounts.get(category.id) ?? 0

    // Prefer category image_url, fall back to representative project photo
    const image = (category as any).image_url as string | null
    const projectImage = image ?? representativeProjectMap.get(category.id)?.primary_photo_url ?? null

    return {
      id: category.id,
      title: getLocalizedName(category as any, locale),
      href: typeSlug ? `/projects?type=${encodeURIComponent(typeSlug)}` : "/projects",
      imageUrl: projectImage,
      count: projectCount > 0 ? `${projectCount}+ projects` : undefined,
    }
  })

  // BrowseSection data - Spaces flagged for homepage carousel (max 5)
  const ts = await getTranslations("spaces")
  const tc = await getTranslations("common")

  const { data: homepageSpaces } = await supabase
    .from("spaces")
    .select("slug, name, image_url, sort_order")
    .eq("is_active", true)
    .eq("in_home_carrousel" as any, true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .limit(5)

  const spaceConfig = (homepageSpaces ?? []).map((s: any) => {
    // Try to get translated name, fall back to DB name
    const slugKey = s.slug?.replace(/-/g, "_") ?? ""
    let title = s.name
    try {
      const translated = ts(slugKey as any)
      if (translated && !translated.startsWith("spaces.")) title = translated
    } catch {}
    return { slug: s.slug, title, imageUrl: s.image_url as string | null }
  })

  // Build map: prefer admin-uploaded images, fall back to project photos
  const spacePhotoMap = new Map<string, string>()
  for (const s of spaceConfig) {
    if (s.imageUrl) spacePhotoMap.set(s.slug, s.imageUrl)
  }

  // Fall back to project photos for spaces without admin image
  const missingSlugs = spaceConfig.filter((s) => !spacePhotoMap.has(s.slug)).map((s) => s.slug)
  if (missingSlugs.length > 0) {
    const { data: spacePhotos } = await supabase
      .from("project_features")
      .select("space:spaces!space_id(slug), project_photos!project_photos_feature_id_fkey(url, is_primary, order_index)")
      .not("space_id", "is", null)

    for (const feature of (spacePhotos ?? []) as any[]) {
      const slug = feature.space?.slug
      if (!slug || spacePhotoMap.has(slug) || !missingSlugs.includes(slug)) continue
      const photos = (feature.project_photos ?? [])
        .filter((p: any) => p.url)
        .sort((a: any, b: any) => {
          if (a.is_primary && !b.is_primary) return -1
          if (!a.is_primary && b.is_primary) return 1
          return (a.order_index ?? 0) - (b.order_index ?? 0)
        })
      if (photos[0]?.url) spacePhotoMap.set(slug, photos[0].url)
    }
  }

  const browseSpaces: BrowseCard[] = spaceConfig.map((s, i) => ({
    id: String(i + 1),
    title: s.title,
    href: `/projects?space=${s.slug}`,
    imageUrl: spacePhotoMap.get(s.slug) ?? null,
  }))

  // BrowseSection data - Professionals: use homepage-flagged child services
  const browseProfessionals: BrowseCard[] = homeProfessionalServices
    .map((category) => {
      const image = (category as any).image_url
      // For child services, link with the service filter
      return {
        id: category.id,
        title: getLocalizedName(category as any, locale),
        href: `/professionals?services=${encodeURIComponent(category.id)}`,
        imageUrl: image ?? null,
      } as BrowseCard
    })

  const allCategories = [...parentCategories, ...childCategories]
  const labelMap = new Map<string, string>()
  allCategories.forEach((category) => {
    if (category.id && category.name) labelMap.set(category.id, getLocalizedName(category as any, locale))
  })

  const taxonomyOptionsResult = await supabase
    .from("project_taxonomy_options")
    .select("id, name")
    .eq("is_active", true)

  if (!taxonomyOptionsResult.error) {
    const taxonomyOptions = taxonomyOptionsResult.data ?? []
    taxonomyOptions.forEach((option) => {
      if (option.id && option.name) labelMap.set(option.id, option.name)
    })
  }

  const heroProjectCards: HeroProject[] = heroProjects.map((project) => {
    const projectAny = project as any
    const style = projectAny.style_preferences?.[0] || ""
    const subType = project.project_type || ""
    const location = project.location || ""
    const parts = []
    if (style) parts.push(labelMap.get(style) || style)
    if (subType) parts.push(labelMap.get(subType) || subType)
    if (location) parts.push(`in ${location}`)
    const caption = parts.length > 0 ? parts.join(" ") : undefined

    return {
      id: project.id,
      title: project.title ?? "Untitled project",
      href: project.slug ? `/projects/${project.slug}` : "/projects",
      imageUrl: project.primary_photo_url,
      caption,
    }
  })

  const resolvedHeroProjects = heroProjectCards.length > 0 ? heroProjectCards : FALLBACK_HERO_PROJECTS

  const recentProjectCards: RecentProject[] = popularProjects.slice(0, 6).map((project) => {
    const projectAny = project as any
    const primaryCategory = projectAny.primary_category
    const primaryCategorySlug = projectAny.primary_category_slug
    const typeLabel = primaryCategory
      ? (translateCategoryName(primaryCategorySlug ?? primaryCategory, locale)
          ?? labelMap.get(primaryCategory)
          ?? primaryCategory)
      : null
    const location = project.location || null
    const subtitle = [typeLabel, location].filter(Boolean).join(" · ")

    const localizedTitle =
      getProjectTranslation(
        { title: project.title, translations: projectAny.translations },
        "title",
        locale,
      ) || project.title

    return {
      id: project.id,
      title: localizedTitle || "Untitled",
      href: project.slug ? `/projects/${project.slug}` : "/projects",
      imageUrl: project.primary_photo_url,
      subtitle: subtitle || undefined,
    }
  })

  const featuredCompanyIds = featuredCompaniesRaw.map((company) => company.id)
  let companyCoverPhotos: Map<string, string> = new Map()

  if (featuredCompanyIds.length > 0) {
    const [photosResult, projectPhotosResult] = await Promise.all([
      supabase
        .from("company_photos")
        .select("company_id, url, is_cover, order_index")
        .in("company_id", featuredCompanyIds)
        .order("is_cover", { ascending: false })
        .order("order_index", { ascending: true }),
      // Fallback: project photos for companies without company_photos
      supabase
        .from("project_professionals")
        .select("company_id, projects!inner(project_photos(url, is_primary, order_index))")
        .in("company_id", featuredCompanyIds)
        .in("status", ["live_on_page", "listed"]),
    ])

    if (!photosResult.error && photosResult.data) {
      const photosByCompany = new Map<string, string>()
      photosResult.data.forEach((photo) => {
        if (!photosByCompany.has(photo.company_id)) {
          photosByCompany.set(photo.company_id, photo.url)
        }
      })
      companyCoverPhotos = photosByCompany
    }

    // Build project photo fallback map for companies without company_photos
    if (!projectPhotosResult.error && projectPhotosResult.data) {
      for (const row of projectPhotosResult.data as any[]) {
        if (!row.company_id || companyCoverPhotos.has(row.company_id)) continue
        const photos = row.projects?.project_photos ?? []
        const sorted = [...photos].sort((a: any, b: any) => {
          if (a.is_primary && !b.is_primary) return -1
          if (!a.is_primary && b.is_primary) return 1
          return (a.order_index ?? 0) - (b.order_index ?? 0)
        })
        if (sorted[0]?.url) {
          companyCoverPhotos.set(row.company_id, sorted[0].url)
        }
      }
    }
  }

  const featuredCompanies: FeaturedCompany[] = featuredCompaniesRaw.map((company) => {
    const location = [company.city, company.country].filter(Boolean).join(", ") || tc("location_unavailable")
    const slug = company.slug ?? company.id ?? ""
    const coverPhoto = companyCoverPhotos.get(company.id)
    const svc = company.primary_service as { name: string; name_nl?: string | null } | null
    const title = (locale === "nl" && svc?.name_nl) ? svc.name_nl : (svc?.name || tc("professional_services"))

    return {
      id: company.id,
      name: company.name,
      title,
      location,
      image: (company as any).hero_photo_url || coverPhoto || PLACEHOLDER_IMAGE,
      logoUrl: company.logo_url ?? null,
      href: `/professionals/${slug}`,
    }
  })

  return {
    heroProjects: resolvedHeroProjects,
    browseProjects,
    browseSpaces,
    browseProfessionals,
    recentProjects: recentProjectCards,
    featuredCompanies,
  }
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations("home")
  const {
    heroProjects,
    browseProjects,
    browseSpaces,
    browseProfessionals,
    recentProjects,
    featuredCompanies,
  } = await loadLandingData(locale)

  // Check if current user is super admin (for hero editor)
  let isSuperAdmin = false
  try {
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { session } } = await supabaseAuth.auth.getSession()
    if (session?.user) {
      const { data: profile } = await supabaseAuth
        .from("profiles")
        .select("admin_role")
        .eq("id", session.user.id)
        .maybeSingle()
      isSuperAdmin = profile?.admin_role === "super_admin"
    }
  } catch {}

  return (
    <div className="min-h-screen bg-background">
      <TrackPageView path="/" />
      <Header transparent />
      <main className="pt-0">

        {/* 1. Hero — full bleed, editorial headline */}
        <HeroSection projects={heroProjects} isSuperAdmin={isSuperAdmin} />

        {/* 2. Positioning Statement */}
        <section className="py-16 max-md:py-10 bg-white">
          <div className="wrap text-center">
            <h2 className="arco-page-title mb-8 max-md:mb-5">
              {t("positioning_title")}
            </h2>
            <p className="arco-body-text max-w-[900px] mx-auto">
              {t("positioning_body")}
            </p>
          </div>
        </section>

        {/* 3. Browse Section - Projects, Spaces, Professionals */}
        <BrowseSection 
          projects={browseProjects}
          spaces={browseSpaces}
          professionals={browseProfessionals}
        />

        {/* 4. Recent Projects */}
        <RecentProjects projects={recentProjects} />

        {/* 5. How Arco works */}
        <FeaturesSection />

        {/* 6. Featured Studios */}
        <FeaturedCompanies companies={featuredCompanies} />

        {/* 7. Membership CTA */}
        <MembershipCTA />

      </main>
      <Footer />
    </div>
  )
}
