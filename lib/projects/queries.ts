import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { getProjectTranslation } from "@/lib/project-translations"
import type { Tables } from "@/lib/supabase/types"

const INITIAL_PAGE_SIZE = 12

// ─── Base row from the view ────────────────────────────────────────────────────

type ProjectSearchDocument = Tables<"project_search_documents">

// ─── Hydrated shape returned to the UI ────────────────────────────────────────

export interface DiscoverProject extends ProjectSearchDocument {
  /** Ordered photos with space slug tags for the space filter */
  photos: Array<{
    id: string
    url: string
    alt: string | null
    /** Space slug of the feature this photo belongs to (e.g. "kitchen", "bathroom").
     *  Null for photos not assigned to any feature. */
    space: string | null
    order_index: number
    is_primary: boolean
  }>
  /**
   * Pre-aggregated set of space slugs present on this project.
   * Used for O(1) card-level matching when a space filter is active.
   * e.g. ["kitchen", "bathroom", "living-room"]
   */
  spaces: string[]
  /** Display name of the owning studio / company */
  professional_name: string | null
  /** Slug for linking to /professionals/[slug] */
  professional_slug: string | null
}

// ─── Internal join types ───────────────────────────────────────────────────────

interface FeatureWithCategoryAndPhoto {
  id: string
  project_id: string
  cover_photo_id: string | null
  order_index: number
  category: {
    slug: string
    name: string
  } | null
  cover_photo: {
    id: string
    url: string
    alt_text: string | null
    order_index: number | null
    is_primary: boolean | null
  } | null
}

interface PhotoWithFeature {
  id: string
  project_id: string
  url: string
  alt_text: string | null
  order_index: number | null
  is_primary: boolean | null
  feature_id: string | null
  feature: {
    category: {
      slug: string
    } | null
  } | null
}

interface ProjectProfessional {
  project_id: string
  company: {
    name: string
    slug: string | null
    status: string | null
  } | null
}

// ─── Query ────────────────────────────────────────────────────────────────────

export const fetchDiscoverProjects = async (locale: string = "en"): Promise<DiscoverProject[]> => {
  const supabase = await createServerSupabaseClient()

  // ── 1. Base project rows ──────────────────────────────────────────────────
  const { data: baseRows, error: baseError } = await supabase
    .from("project_search_documents")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(INITIAL_PAGE_SIZE)

  if (baseError) {
    logger.error("Failed to load projects for discover", {
      function: "fetchDiscoverProjects",
      error: baseError,
    })
    return []
  }

  if (!baseRows || baseRows.length === 0) return []

  const projectIds = baseRows.map((r) => r.id).filter(Boolean) as string[]

  // ── 2. Photos with space tags (parallel with professionals) ────────────────
  // Photos are joined through their feature → feature's space gives us the space slug.
  const photosPromise = supabase
    .from("project_photos")
    .select(`
      id,
      project_id,
      url,
      alt_text,
      order_index,
      is_primary,
      feature_id,
      feature:project_features!feature_id (
        space:spaces!space_id (
          slug
        )
      )
    `)
    .in("project_id", projectIds)
    .order("is_primary", { ascending: false, nullsFirst: false })
    .order("order_index", { ascending: true, nullsFirst: false })

  // ── 3. Owning professional (company) ──────────────────────────────────────
  // project_professionals.is_project_owner = true identifies the studio
  // that published the project. status 'live_on_page' or 'listed' means
  // the relationship is active.
  const professionalsPromise = supabase
    .from("project_professionals")
    .select(`
      project_id,
      company:companies!company_id (
        name,
        slug,
        status
      )
    `)
    .in("project_id", projectIds)
    .eq("is_project_owner", true)
    .in("status", ["live_on_page", "listed"])

  const [photosResult, professionalsResult] = await Promise.all([
    photosPromise,
    professionalsPromise,
  ])

  if (photosResult.error) {
    logger.warn("Failed to load photos for discover projects", {
      function: "fetchDiscoverProjects",
      error: photosResult.error,
    })
  }

  if (professionalsResult.error) {
    logger.warn("Failed to load professionals for discover projects", {
      function: "fetchDiscoverProjects",
      error: professionalsResult.error,
    })
  }

  // ── 4. Build lookup maps ───────────────────────────────────────────────────

  // Photos grouped by project_id
  const photosByProject = new Map<
    string,
    Array<DiscoverProject["photos"][number]>
  >()

  for (const rawPhoto of (photosResult.data ?? []) as unknown as PhotoWithFeature[]) {
    if (!rawPhoto.project_id) continue

    const spaceSlug =
      (rawPhoto.feature as any)?.space?.slug ?? null

    const mapped: DiscoverProject["photos"][number] = {
      id: rawPhoto.id,
      url: rawPhoto.url,
      alt: rawPhoto.alt_text ?? null,
      space: spaceSlug,
      order_index: rawPhoto.order_index ?? 0,
      is_primary: rawPhoto.is_primary ?? false,
    }

    const existing = photosByProject.get(rawPhoto.project_id) ?? []
    // Include up to 5 photos for carousel, plus one photo per unique space
    // so space filtering works on SSR-loaded projects
    const spacesIncluded = new Set(existing.map((p) => p.space).filter(Boolean))
    const isNewSpace = spaceSlug && !spacesIncluded.has(spaceSlug)
    if (existing.length < 5 || isNewSpace) {
      existing.push(mapped)
    }
    photosByProject.set(rawPhoto.project_id, existing)
  }

  // Professional name/slug keyed by project_id
  const professionalByProject = new Map<
    string,
    { name: string; slug: string | null }
  >()

  const hiddenProjectIds = new Set<string>()
  for (const row of (professionalsResult.data ?? []) as unknown as ProjectProfessional[]) {
    if (!row.project_id || !row.company) continue
    // Hide projects owned by "added" companies (not yet visible)
    if (row.company.status === "added") {
      hiddenProjectIds.add(row.project_id)
      continue
    }
    // First entry wins (there should only be one owner per project)
    if (!professionalByProject.has(row.project_id)) {
      professionalByProject.set(row.project_id, {
        name: row.company.name,
        slug: row.company.slug ?? null,
      })
    }
  }

  // ── 5. Merge ───────────────────────────────────────────────────────────────

  return baseRows.filter((project) => !hiddenProjectIds.has(project.id ?? "")).map((project): DiscoverProject => {
    const id = project.id ?? ""
    const photos = photosByProject.get(id) ?? []

    // Derive the unique set of space slugs from the photos
    const spaces = Array.from(
      new Set(photos.map((p) => p.space).filter((s): s is string => s !== null)),
    )

    const professional = professionalByProject.get(id) ?? null

    // Resolve locale-aware title + description at the query boundary so all
    // downstream cards stay locale-agnostic. Falls back to the base column
    // when no translation is present for the requested locale.
    const localizedTitle = getProjectTranslation(
      { title: project.title, translations: project.translations as Record<string, any> | null },
      "title",
      locale,
    )
    const localizedDescription = getProjectTranslation(
      { description: project.description, translations: project.translations as Record<string, any> | null },
      "description",
      locale,
    )

    return {
      ...project,
      title: localizedTitle || project.title,
      description: localizedDescription || project.description,
      photos,
      spaces,
      professional_name: professional?.name ?? null,
      professional_slug: professional?.slug ?? null,
    }
  })
}
