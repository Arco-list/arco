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

async function loadLandingData() {
  const supabase = await createServerSupabaseClient()

  const [
    heroProjectsResult,
    popularProjectsResult,
    parentCategoriesResult,
    professionalCategoriesResult,
    professionalSpecialtiesResult,
    featuredCompaniesResult,
  ] = await Promise.all([
    supabase.rpc("search_projects", { featured_only: true, limit_count: 5 }),
    supabase.rpc("search_projects", { limit_count: 12 }),
    supabase
      .from("categories")
      .select("id,name,slug,parent_id,sort_order,project_category_attributes(is_listable)")
      .eq("is_active", true)
      .is("parent_id", null)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    supabase
      .from("categories")
      .select("id,name,slug,parent_id,sort_order,image_url")
      .eq("is_active", true)
      .is("parent_id", null)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    supabase
      .from("mv_professional_summary")
      .select("id, primary_specialty_slug")
      .not("primary_specialty_slug", "is", null),
    supabase
      .from("companies")
      .select(`
        id,
        name,
        slug,
        city,
        country,
        logo_url,
        primary_service_id,
        primary_service:categories!companies_primary_service_id_fkey(name)
      `)
      .eq("is_featured", true)
      .eq("status", "listed")
      .limit(6),
  ])

  if (heroProjectsResult.error) logger.error("Failed to load featured hero projects", { scope: "landing" }, heroProjectsResult.error)
  if (popularProjectsResult.error) logger.error("Failed to load popular projects", { scope: "landing" }, popularProjectsResult.error)
  if (parentCategoriesResult.error) logger.error("Failed to load project categories", { scope: "landing" }, parentCategoriesResult.error)
  if (professionalCategoriesResult.error) logger.error("Failed to load professional categories", { scope: "landing" }, professionalCategoriesResult.error)
  if (professionalSpecialtiesResult.error) logger.error("Failed to load professional specialties", { scope: "landing" }, professionalSpecialtiesResult.error)
  if (featuredCompaniesResult.error) logger.error("Failed to load featured companies", { scope: "landing" }, featuredCompaniesResult.error)

  const heroProjects = (heroProjectsResult.data ?? []).filter((project) => Boolean(project?.slug))
  const popularProjects = (popularProjectsResult.data ?? []).filter((project) => Boolean(project?.slug))
  const parentCategories = (parentCategoriesResult.data as CategoryRow[] | null) ?? []
  const professionalCategoriesRaw = (professionalCategoriesResult.data as Tables<"categories">[] | null) ?? []
  const professionalSpecialties = professionalSpecialtiesResult.data ?? []
  const featuredCompaniesRaw = featuredCompaniesResult.data ?? []

  let childCategories: CategoryRow[] = []

  if (parentCategories.length > 0) {
    const parentIds = parentCategories.map((category) => category.id)
    const childCategoriesResult = await supabase
      .from("categories")
      .select("id,name,slug,parent_id,sort_order,project_category_attributes(is_listable)")
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

  const uniqueCategoryIdsForImages = Array.from(new Set(listableChildCategories.map((child) => child.id)))

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

  // NEW: BrowseSection data - Projects
  const browseProjects: BrowseCard[] = projectCategoriesRaw
    .filter((category) => category.children?.some((child) => child.project_category_attributes?.is_listable))
    .slice(0, 5)
    .map((category) => {
      const listableChildren = (category.children ?? [])
        .filter((child) => child.project_category_attributes?.is_listable)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

      const childWithProject = listableChildren.find((child) => {
        const project = representativeProjectMap.get(child.id)
        return project && project.primary_photo_url
      })

      const representativeProject = childWithProject
        ? representativeProjectMap.get(childWithProject.id)
        : undefined

      const typeSlug = normalizeSlug(category.slug) || normalizeSlug(category.name)
      
      // Calculate total count for this parent category
      const totalCount = listableChildren.reduce((sum, child) => {
        return sum + (categoryCounts.get(child.id) ?? 0)
      }, 0)

      return {
        id: category.id,
        title: category.name,
        href: typeSlug ? `/projects?type=${encodeURIComponent(typeSlug)}` : "/projects",
        imageUrl: representativeProject?.primary_photo_url ?? null,
        count: totalCount > 0 ? `${totalCount}+ projects` : undefined,
      }
    })

  // NEW: BrowseSection data - Spaces (hardcoded for now - you can make dynamic later)
  const browseSpaces: BrowseCard[] = [
    { id: '1', title: 'Kitchen', href: '/projects?space=kitchen', imageUrl: null },
    { id: '2', title: 'Living Room', href: '/projects?space=living-room', imageUrl: null },
    { id: '3', title: 'Bedroom', href: '/projects?space=bedroom', imageUrl: null },
    { id: '4', title: 'Bathroom', href: '/projects?space=bathroom', imageUrl: null },
    { id: '5', title: 'Outdoor', href: '/projects?space=outdoor', imageUrl: null },
  ]

  // NEW: BrowseSection data - Professionals
  const professionalCategoryCounts = new Map<string, number>()
  professionalSpecialties.forEach((entry) => {
    const specialtySlug = normalizeSlug(entry.primary_specialty_slug ?? "")
    if (!specialtySlug) return
    const parentSlug = parentSlugByChildSlug.get(specialtySlug)
    const categoryToCount = parentSlug || specialtySlug
    professionalCategoryCounts.set(categoryToCount, (professionalCategoryCounts.get(categoryToCount) ?? 0) + 1)
  })

  const browseProfessionals: BrowseCard[] = professionalCategoriesRaw
    .map((category) => {
      const normalizedSlug = normalizeSlug(category.slug) || normalizeSlug(category.name)
      const image = (category as any).image_url
      if (!image) return null
      
      return {
        id: category.id,
        title: category.name ?? "",
        href: `/professionals?categories=${encodeURIComponent(category.id)}`,
        imageUrl: image,
      } as BrowseCard
    })
    .filter((category): category is BrowseCard => category !== null)
    .slice(0, 5)

  const allCategories = [...parentCategories, ...childCategories]
  const labelMap = new Map<string, string>()
  allCategories.forEach((category) => {
    if (category.id && category.name) labelMap.set(category.id, category.name)
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
    const style = projectAny.style_preferences?.[0] || ""
    const subType = project.project_type || ""
    const location = project.location || "Location unavailable"
    const parts = []
    if (style) parts.push(labelMap.get(style) || style)
    if (subType) parts.push(labelMap.get(subType) || subType)
    parts.push(`in ${location}`)
    const title = parts.join(" ")

    return {
      id: project.id,
      title,
      href: project.slug ? `/projects/${project.slug}` : "/projects",
      imageUrl: project.primary_photo_url,
      subtitle: undefined,  // Architect name not available in search results
    }
  })

  const featuredCompanyIds = featuredCompaniesRaw.map((company) => company.id)
  let companyMetrics: Map<string, { averageRating: number; totalReviews: number }> = new Map()
  let companyCoverPhotos: Map<string, string> = new Map()

  if (featuredCompanyIds.length > 0) {
    const [metricsResult, photosResult] = await Promise.all([
      supabase
        .from("company_metrics")
        .select("company_id, average_rating, total_reviews")
        .in("company_id", featuredCompanyIds),
      supabase
        .from("company_photos")
        .select("company_id, url, is_cover, order_index")
        .in("company_id", featuredCompanyIds)
        .order("is_cover", { ascending: false })
        .order("order_index", { ascending: true }),
    ])

    if (!metricsResult.error && metricsResult.data) {
      metricsResult.data.forEach((metric) => {
        if (!metric.company_id) return
        companyMetrics.set(metric.company_id, {
          averageRating: metric.average_rating || 0,
          totalReviews: metric.total_reviews || 0,
        })
      })
    }

    if (!photosResult.error && photosResult.data) {
      const photosByCompany = new Map<string, string>()
      photosResult.data.forEach((photo) => {
        if (!photosByCompany.has(photo.company_id)) {
          photosByCompany.set(photo.company_id, photo.url)
        }
      })
      companyCoverPhotos = photosByCompany
    }
  }

  const featuredCompanies: FeaturedCompany[] = featuredCompaniesRaw.map((company) => {
    const location = [company.city, company.country].filter(Boolean).join(", ") || "Location unavailable"
    const slug = company.slug ?? company.id ?? ""
    const metrics = companyMetrics.get(company.id) || { averageRating: 0, totalReviews: 0 }
    const coverPhoto = companyCoverPhotos.get(company.id)
    const title = (company.primary_service as { name: string } | null)?.name || "Professional services"

    return {
      id: company.id,
      name: company.name,
      title,
      location,
      rating: metrics.averageRating,
      reviews: metrics.totalReviews,
      image: coverPhoto || company.logo_url || PLACEHOLDER_IMAGE,
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

export default async function HomePage() {
  const {
    heroProjects,
    browseProjects,
    browseSpaces,
    browseProfessionals,
    recentProjects,
    featuredCompanies,
  } = await loadLandingData()

  return (
    <div className="min-h-screen bg-background">
      <Header transparent />
      <main className="pt-0">

        {/* 1. Hero — full bleed, editorial headline */}
        <HeroSection projects={heroProjects} />

        {/* 2. Positioning Statement - UPDATED: Uses .wrap class */}
        <section className="py-16 bg-white">
          <div className="wrap text-center">
            <h2 className="arco-page-title mb-8">
              The professional network architects trust
            </h2>
            <p className="arco-body-text max-w-[900px] mx-auto">
              Arco is where leading architects publish their residential work and credential the professionals they collaborate with. We help discerning clients discover exceptional teams through real projects — builders, interior designers, landscape architects, and specialists who have earned their reputation through craft, not advertising.
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
