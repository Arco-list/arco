import { createServerSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import type { Database, Tables } from "@/lib/supabase/types"
import { Header } from "@/components/header"
import { HeroSection, type HeroProject } from "@/components/hero-section"
import { ProjectCategories, type ProjectCategoryCard } from "@/components/project-categories"
import { PopularProjects, type PopularProjectCard } from "@/components/popular-projects"
import { FeaturesSection } from "@/components/features-section"
import { FeaturedCompanies, type FeaturedCompany } from "@/components/featured-companies"
import { ProfessionalCategories, type ProfessionalCategoryCard } from "@/components/professional-categories"
import { ProjectTypes, type ProjectTypeCard } from "@/components/project-types"
import { Footer } from "@/components/footer"

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
    title: "World's finest architectural constructions",
    href: "/projects",
    imageUrl: "/placeholder.svg?height=1080&width=1920",
    caption: "Modern Villa in Amsterdam",
  },
  {
    id: "fallback-2",
    title: "World's finest architectural constructions",
    href: "/projects",
    imageUrl: "/placeholder.svg?height=1080&width=1920",
    caption: "Contemporary Residence in Rotterdam",
  },
  {
    id: "fallback-3",
    title: "World's finest architectural constructions",
    href: "/projects",
    imageUrl: "/placeholder.svg?height=1080&width=1920",
    caption: "Luxury Estate in Utrecht",
  },
  {
    id: "fallback-4",
    title: "World's finest architectural constructions",
    href: "/projects",
    imageUrl: "/placeholder.svg?height=1080&width=1920",
    caption: "Minimalist Home in The Hague",
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

  if (heroProjectsResult.error) {
    logger.error("Failed to load featured hero projects", { scope: "landing" }, heroProjectsResult.error)
  }
  if (popularProjectsResult.error) {
    logger.error("Failed to load popular projects", { scope: "landing" }, popularProjectsResult.error)
  }
  if (parentCategoriesResult.error) {
    logger.error("Failed to load project categories", { scope: "landing" }, parentCategoriesResult.error)
  }
  if (professionalCategoriesResult.error) {
    logger.error("Failed to load professional categories", { scope: "landing" }, professionalCategoriesResult.error)
  }
  if (professionalSpecialtiesResult.error) {
    logger.error("Failed to load professional specialties", { scope: "landing" }, professionalSpecialtiesResult.error)
  }
  if (featuredCompaniesResult.error) {
    logger.error("Failed to load featured companies", { scope: "landing" }, featuredCompaniesResult.error)
  }

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
      logger.error(
        "Failed to load project subcategories",
        { scope: "landing" },
        childCategoriesResult.error,
      )
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
    .filter(Boolean) as Tables<"categories"> & {
    project_category_attributes?: Pick<Tables<"project_category_attributes">, "is_listable"> | null
  }[]

  const uniqueCategoryIdsForImages = Array.from(new Set(listableChildCategories.map((child) => child.id)))

  const representativeProjectResults = await Promise.all(
    uniqueCategoryIdsForImages.map((categoryId) =>
      supabase.rpc("search_projects", {
        category_filter: categoryId,
        limit_count: 1,
      }),
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
    if (categoryId) {
      representativeProjectMap.set(categoryId, project)
    }
  })

  const projectCategories: ProjectCategoryCard[] = projectCategoriesRaw
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

      return {
        id: category.id,
        title: category.name,
        href: typeSlug ? `/projects?type=${encodeURIComponent(typeSlug)}` : "/projects",
        imageUrl: representativeProject?.primary_photo_url ?? null,
      }
    })

  const projectTypes: ProjectTypeCard[] = listableChildCategories.slice(0, 5).map((type) => {
    const representativeProject = representativeProjectMap.get(type.id)
    return {
      id: type.id,
      title: type.name,
      href: `/projects?type=${encodeURIComponent(type.slug ?? type.name)}`,
      imageUrl: representativeProject?.primary_photo_url ?? null,
    }
  })

  // Build mapping for title formatting (categories + taxonomy options)
  const allCategories = [...parentCategories, ...childCategories]
  const labelMap = new Map<string, string>()

  // Add categories to the map
  allCategories.forEach(category => {
    if (category.id && category.name) {
      labelMap.set(category.id, category.name)
    }
  })

  // Add taxonomy options to the map
  const taxonomyOptionsResult = await supabase
    .from("project_taxonomy_options")
    .select("id, name")
    .eq("is_active", true)

  if (!taxonomyOptionsResult.error) {
    const taxonomyOptions = taxonomyOptionsResult.data ?? []
    taxonomyOptions.forEach(option => {
      if (option.id && option.name) {
        labelMap.set(option.id, option.name)
      }
    })
  }

  const heroProjectCards: HeroProject[] = heroProjects.map((project) => {
    const style = project.style_preferences?.[0] || ""
    const subType = project.project_type || ""
    const location = project.location || ""

    const parts = []
    if (style) {
      const styleLabel = labelMap.get(style) || style
      parts.push(styleLabel)
    }
    if (subType) {
      const subTypeLabel = labelMap.get(subType) || subType
      parts.push(subTypeLabel)
    }
    if (location) {
      parts.push(`in ${location}`)
    }

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

  const popularProjectCards: PopularProjectCard[] = popularProjects.slice(0, 10).map((project) => {
    const style = project.style_preferences?.[0] || ""
    const subType = project.project_type || ""
    const location = project.location || "Location unavailable"
    
    const parts = []
    if (style) {
      const styleLabel = labelMap.get(style) || style
      parts.push(styleLabel)
    }
    if (subType) {
      const subTypeLabel = labelMap.get(subType) || subType
      parts.push(subTypeLabel)
    }
    parts.push(`in ${location}`)
    
    const title = parts.join(" ")
    
    return {
      id: project.id,
      title,
      href: project.slug ? `/projects/${project.slug}` : "/projects",
      imageUrl: project.primary_photo_url,
      likes: project.likes_count ?? 0,
    }
  })

  const professionalCategoryCounts = new Map<string, number>()
  professionalSpecialties.forEach((entry) => {
    const specialtySlug = normalizeSlug(entry.primary_specialty_slug)
    if (!specialtySlug) return
    const parentSlug = parentSlugByChildSlug.get(specialtySlug)
    if (!parentSlug) return
    professionalCategoryCounts.set(parentSlug, (professionalCategoryCounts.get(parentSlug) ?? 0) + 1)
  })

  const professionalCategoryCards: ProfessionalCategoryCard[] = professionalCategoriesRaw
    .map((category) => {
      const normalizedSlug = normalizeSlug(category.slug) || normalizeSlug(category.name)
      const image = (category as any).image_url
      if (!image) return null

      const count = professionalCategoryCounts.get(normalizedSlug)
      if (!count || count <= 0) return null
      const countLabel = `${count} professional${count === 1 ? "" : "s"}`

      return {
        id: category.id,
        title: category.name,
        href: `/professionals?categories=${encodeURIComponent(normalizedSlug)}`,
        imageUrl: image,
        countLabel,
      }
    })
    .filter((category): category is ProfessionalCategoryCard => Boolean(category))
    .slice(0, 5)

  // Fetch rating data and cover photos for featured companies
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
        .order("order_index", { ascending: true })
    ])

    if (!metricsResult.error && metricsResult.data) {
      metricsResult.data.forEach((metric) => {
        companyMetrics.set(metric.company_id, {
          averageRating: metric.average_rating || 0,
          totalReviews: metric.total_reviews || 0,
        })
      })
    }

    if (!photosResult.error && photosResult.data) {
      // Get first photo (prioritized by is_cover DESC, order_index ASC)
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
    const slug = company.slug || company.id
    const metrics = companyMetrics.get(company.id) || { averageRating: 0, totalReviews: 0 }
    const coverPhoto = companyCoverPhotos.get(company.id)

    // Use primary service name as title
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
    projectCategories,
    popularProjects: popularProjectCards,
    projectTypes,
    professionalCategories: professionalCategoryCards,
    featuredCompanies,
  }
}

export default async function HomePage() {
  const { heroProjects, projectCategories, popularProjects, projectTypes, professionalCategories, featuredCompanies } =
    await loadLandingData()

  return (
    <div className="min-h-screen bg-white">
      <Header transparent />
      <main className="pt-0">
        <HeroSection projects={heroProjects} />
        <ProjectCategories categories={projectCategories} />
        <PopularProjects projects={popularProjects} />
        <FeaturesSection />
        <ProfessionalCategories categories={professionalCategories} />
        <FeaturedCompanies companies={featuredCompanies} />
        <ProjectTypes types={projectTypes} />
      </main>
      <Footer />
    </div>
  )
}
