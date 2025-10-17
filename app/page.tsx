import { createServerSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import type { Database, Tables } from "@/lib/supabase/types"
import { Header } from "@/components/header"
import { HeroSection, type HeroProject } from "@/components/hero-section"
import { ProjectCategories, type ProjectCategoryCard } from "@/components/project-categories"
import { PopularProjects, type PopularProjectCard } from "@/components/popular-projects"
import { FeaturesSection } from "@/components/features-section"
import { PopularServices } from "@/components/popular-services"
import { FeaturedProfessionals, type FeaturedProfessional } from "@/components/featured-professionals"
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

const PROFESSIONAL_CATEGORY_IMAGE_MAP: Record<string, string> = {
  "design-planning": "/professional-architect-working-on-blueprints.jpg",
  "construction": "/construction-manager-at-building-site.jpg",
  "systems": "/structural-engineer-working-on-technical-drawings.jpg",
  "finishing": "/interior-designer-working-on-modern-room-design.jpg",
  "outdoor": "/landscape-designer-working-in-beautiful-garden.jpg",
}

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
    caption: "Villa Ega, Marco van Veldhuizen",
  },
  {
    id: "fallback-2",
    title: "Contemporary living spaces",
    href: "/projects",
    imageUrl: "/placeholder.svg?height=1080&width=1920",
    caption: "Paradise Villa, Amsterdam",
  },
  {
    id: "fallback-3",
    title: "Innovative architectural design",
    href: "/projects",
    imageUrl: "/placeholder.svg?height=1080&width=1920",
    caption: "Villa Mel, Rotterdam",
  },
  {
    id: "fallback-4",
    title: "Luxury residential projects",
    href: "/projects",
    imageUrl: "/placeholder.svg?height=1080&width=1920",
    caption: "Garden House, Utrecht",
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
    featuredProfessionalsResult,
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
      .select("id,name,slug,parent_id,sort_order")
      .eq("is_active", true)
      .is("parent_id", null)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    supabase
      .from("mv_professional_summary")
      .select("id, primary_specialty_slug")
      .not("primary_specialty_slug", "is", null),
    supabase
      .from("mv_professional_summary")
      .select("id, first_name, last_name, title, primary_specialty, company_name, company_city, user_location, display_rating, total_reviews, avatar_url")
      .eq("is_featured", true)
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
  if (featuredProfessionalsResult.error) {
    logger.error("Failed to load featured professionals", { scope: "landing" }, featuredProfessionalsResult.error)
  }

  const heroProjects = (heroProjectsResult.data ?? []).filter((project) => Boolean(project?.slug))
  const popularProjects = (popularProjectsResult.data ?? []).filter((project) => Boolean(project?.slug))
  const parentCategories = (parentCategoriesResult.data as CategoryRow[] | null) ?? []
  const professionalCategoriesRaw = (professionalCategoriesResult.data as Tables<"categories">[] | null) ?? []
  const professionalSpecialties = professionalSpecialtiesResult.data ?? []
  const featuredProfessionalsRaw = featuredProfessionalsResult.data ?? []

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
      const listableChild = (category.children ?? [])
        .filter((child) => child.project_category_attributes?.is_listable)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]

      const representativeProject = listableChild ? representativeProjectMap.get(listableChild.id) : undefined

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

  const heroProjectCards: HeroProject[] = heroProjects.map((project) => ({
    id: project.id,
    title: project.title ?? "Untitled project",
    href: project.slug ? `/projects/${project.slug}` : "/projects",
    imageUrl: project.primary_photo_url,
    caption: [project.primary_category, project.location].filter(Boolean).join(" • ") || undefined,
  }))

  const resolvedHeroProjects = heroProjectCards.length > 0 ? heroProjectCards : FALLBACK_HERO_PROJECTS

  const popularProjectCards: PopularProjectCard[] = popularProjects.slice(0, 10).map((project) => ({
    id: project.id,
    title: project.title ?? "Untitled project",
    href: project.slug ? `/projects/${project.slug}` : "/projects",
    imageUrl: project.primary_photo_url,
    likes: project.likes_count ?? 0,
  }))

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
      const image = PROFESSIONAL_CATEGORY_IMAGE_MAP[normalizedSlug]
      if (!image) return null

      const count = professionalCategoryCounts.get(normalizedSlug)
      if (!count || count <= 0) return null
      const countLabel = `${count} professional${count === 1 ? "" : "s"}`

      return {
        id: category.id,
        title: category.name,
        href: `/professionals?category=${encodeURIComponent(normalizedSlug)}`,
        imageUrl: image,
        countLabel,
      }
    })
    .filter((category): category is ProfessionalCategoryCard => Boolean(category))
    .slice(0, 5)

  const featuredProfessionals: FeaturedProfessional[] = featuredProfessionalsRaw.map((professional) => {
    const name = `${professional.first_name || ''} ${professional.last_name || ''}`.trim()
    const title = professional.title || professional.primary_specialty || 'Professional'
    const location = professional.company_name || professional.company_city || professional.user_location || 'Independent Professional'
    
    return {
      id: professional.id,
      name,
      title,
      location,
      rating: professional.display_rating || 0,
      reviews: professional.total_reviews || 0,
      image: professional.avatar_url,
      href: `/professionals/${professional.id}`,
    }
  })

  return {
    heroProjects: resolvedHeroProjects,
    projectCategories,
    popularProjects: popularProjectCards,
    projectTypes,
    professionalCategories: professionalCategoryCards,
    featuredProfessionals,
  }
}

export default async function HomePage() {
  const { heroProjects, projectCategories, popularProjects, projectTypes, professionalCategories, featuredProfessionals } =
    await loadLandingData()

  return (
    <div className="min-h-screen bg-white">
      <Header transparent />
      <main>
        <HeroSection projects={heroProjects} />
        <ProjectCategories categories={projectCategories} />
        <PopularProjects projects={popularProjects} />
        <FeaturesSection />
        {/* <PopularServices /> */}
        <FeaturedProfessionals professionals={featuredProfessionals} />
        <ProfessionalCategories categories={professionalCategories} />
        <ProjectTypes types={projectTypes} />
      </main>
      <Footer />
    </div>
  )
}
