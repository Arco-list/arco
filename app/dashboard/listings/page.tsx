"use client"

import { DashboardHeader } from "@/components/dashboard-header"
import { Footer } from "@/components/footer"
import Link from "next/link"
import { MoreHorizontal, X, Check } from "lucide-react"
import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { Database, Enums } from "@/lib/supabase/types"
import { DashboardListingsFilter, type FilterState } from "@/components/dashboard-listings-filter"
import { toast } from "sonner"

type ProjectStatus = Enums<"project_status">

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"] & {
  project_photos: {
    url: string
    is_primary: boolean | null
    order_index: number | null
  }[] | null
  project_professionals: {
    is_project_owner: boolean
  }[] | null
}

type ListingProject = {
  id: string
  title: string
  status: ProjectStatus
  statusLabel: string
  statusChipClass: string
  subtitle: string
  coverImageUrl: string
  createdAt: string
  role: "owner" | "contributor"
  projectType: string
  projectYear: number | null
}

const isUuid = (value?: string | null): value is string =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const STATUS_CONFIG: Record<
  ProjectStatus,
  {
    label: string
    chipClass: string
  }
> = {
  draft: { label: "In progress", chipClass: "bg-amber-100 text-amber-800" },
  in_progress: { label: "In review", chipClass: "bg-blue-100 text-blue-800" },
  published: { label: "Live on page", chipClass: "bg-green-100 text-green-800" },
  completed: { label: "Listed", chipClass: "bg-emerald-100 text-emerald-800" },
  archived: { label: "Unlisted", chipClass: "bg-slate-200 text-slate-700" },
}

const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 2000

export default function DashboardListingsPage() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [coverPhotoModalOpen, setCoverPhotoModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ListingProject | null>(null)
  const [selectedStatus, setSelectedStatus] = useState("")
  const [selectedCoverPhoto, setSelectedCoverPhoto] = useState<number>(4)
  const [projects, setProjects] = useState<ListingProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    keyword: "",
    statuses: [],
    roles: [],
    yearFrom: MIN_YEAR,
    yearTo: CURRENT_YEAR,
  })
  // LRU-style cache with size limit to prevent unbounded memory growth
  const taxonomyCacheRef = useRef<{
    styles: Map<string, string>
    accessOrder: string[]
  }>({
    styles: new Map(),
    accessOrder: [],
  })
  const MAX_CACHE_SIZE = 100 // Reasonable limit for taxonomy options
  const router = useRouter()

  useEffect(() => {
    let isActive = true
    let metadataErrorShown = false // Move to effect scope to reset on each run

    const loadProjects = async () => {
      setIsLoading(true)
      setLoadError(null)

      const { data: authData, error: authError } = await supabase.auth.getUser()

      if (!authData?.user || authError) {
        if (isActive) {
          setLoadError(authError?.message ?? "You need to be signed in to view your projects.")
          setProjects([])
          setIsLoading(false)
        }
        return
      }

      // Single optimized query with JOINs to fetch projects with resolved labels
      const { data, error } = await supabase
        .from("projects")
        .select(
          `
          id,
          title,
          status,
          project_type,
          style_preferences,
          address_city,
          address_region,
          created_at,
          project_year,
          client_id,
          categories!projects_project_type_fkey(name),
          project_photos(url, is_primary, order_index),
          project_professionals(is_project_owner)
          `
        )
        .eq("client_id", authData.user.id)
        .order("updated_at", { ascending: false })

      if (error) {
        if (isActive) {
          setLoadError(error.message)
          setProjects([])
          setIsLoading(false)
        }
        return
      }

      const projectRows = (data ?? []) as (ProjectRow & {
        categories: { name: string | null } | null
      })[]

      // Collect style IDs that need resolution (styles can't be JOINed due to array column)
      const styleOptionIds = new Set<string>()
      projectRows.forEach((project) => {
        project.style_preferences?.forEach((value) => {
          if (isUuid(value)) {
            styleOptionIds.add(value)
          }
        })
      })

      const taxonomyCache = taxonomyCacheRef.current
      const missingStyleOptionIds = Array.from(styleOptionIds).filter(
        (id) => !taxonomyCache.styles.has(id),
      )

      let metadataLoadFailed = false

      // Only fetch styles (categories already JOINed)
      if (missingStyleOptionIds.length > 0) {
        const { data: stylesData, error: stylesError } = await supabase
          .from("project_taxonomy_options")
          .select("id, name")
          .in("id", missingStyleOptionIds)

        if (stylesError) {
          metadataLoadFailed = true
          console.error("Failed to resolve style labels", { error: stylesError })
        } else {
          stylesData?.forEach((row) => {
            if (row.id && row.name) {
              // LRU cache eviction: remove oldest entry if cache is full
              if (taxonomyCache.styles.size >= MAX_CACHE_SIZE) {
                const oldestKey = taxonomyCache.accessOrder.shift()
                if (oldestKey) {
                  taxonomyCache.styles.delete(oldestKey)
                }
              }
              taxonomyCache.styles.set(row.id, row.name)
              taxonomyCache.accessOrder.push(row.id)
            }
          })
        }
      }

      if (metadataLoadFailed && isActive) {
        if (!metadataErrorShown) {
          metadataErrorShown = true
          toast.error("We couldn't load project metadata", {
            description: "Refresh the page to try again.",
          })
        }
        setLoadError((prev) => prev ?? "Some project details may be missing. Refresh to retry metadata loading.")
      }

      const styleMap = taxonomyCache.styles

      const normalized: ListingProject[] = projectRows.map((project) => {
        const statusKey = project.status as ProjectStatus
        const statusConfig = STATUS_CONFIG[statusKey] ?? {
          label: statusKey,
          chipClass: "bg-slate-200 text-slate-700",
        }

        const photos = project.project_photos ?? []
        const sortedPhotos = photos.length > 0 ? [...photos].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)) : []
        const primary = photos.find((photo) => photo.is_primary) ?? sortedPhotos[0] ?? null
        const coverImageUrl = primary?.url ?? "/placeholder.svg"

        const rawStyle = project.style_preferences?.[0] ?? null
        const styleLabel = rawStyle
          ? isUuid(rawStyle)
            ? styleMap.get(rawStyle) ?? ""
            : rawStyle
          : ""

        // Use JOINed category name instead of UUID lookup
        const projectTypeLabel = project.categories?.name ??
          (project.project_type && !isUuid(project.project_type) ? project.project_type : "")

        const locationParts = [project.address_city, project.address_region].filter(Boolean).join(", ")
        const subtitlePieces = [styleLabel, projectTypeLabel].filter(Boolean)
        const styleType = subtitlePieces.join(" ")
        const subtitle = [styleType, locationParts ? `in ${locationParts}` : null]
          .filter(Boolean)
          .join(" ") || "Add more project details"

        // Determine role: owner if client_id matches, otherwise check project_professionals
        const isOwner = project.client_id === authData.user.id
        const isProjectOwner = project.project_professionals?.some((pp) => pp.is_project_owner) ?? false
        const role: "owner" | "contributor" = isOwner ? "owner" : isProjectOwner ? "owner" : "contributor"

        return {
          id: project.id,
          title: project.title,
          status: statusKey,
          statusLabel: statusConfig.label,
          statusChipClass: statusConfig.chipClass,
          subtitle,
          coverImageUrl,
          createdAt: project.created_at ?? new Date().toISOString(),
          role,
          projectType: projectTypeLabel,
          projectYear: project.project_year,
        }
      })

      if (isActive) {
        setProjects(normalized)
        setIsLoading(false)
      }
    }

    void loadProjects()

    return () => {
      isActive = false
    }
  }, [supabase])

  const handleUpdateStatus = (project: ListingProject) => {
    setSelectedProject(project)
    setSelectedStatus(project.statusLabel)
    setStatusModalOpen(true)
    setOpenDropdown(null)
  }

  const handleEditCoverImage = (project: ListingProject) => {
    setSelectedProject(project)
    setCoverPhotoModalOpen(true)
    setOpenDropdown(null)
  }

  const handleSaveStatus = () => {
    console.log(`Updating project ${selectedProject.id} status to ${selectedStatus}`)
    setStatusModalOpen(false)
    setSelectedProject(null)
  }

  const handleSaveCoverPhoto = () => {
    console.log(`Updating project ${selectedProject.id} cover photo to ${selectedCoverPhoto}`)
    setCoverPhotoModalOpen(false)
    setSelectedProject(null)
  }

  const handleEditListing = (project: ListingProject) => {
    setOpenDropdown(null)
    // If project is draft (in progress), redirect to new-project flow
    if (project.status === "draft") {
      router.push(`/new-project/details?projectId=${project.id}`)
    } else {
      router.push(`/dashboard/edit/${project.id}`)
    }
  }

  // Client-side filtering with debouncing
  const filteredProjects = useMemo(() => {
    let result = projects

    // Keyword filter (title and project type)
    if (filters.keyword.trim()) {
      const keyword = filters.keyword.toLowerCase()
      result = result.filter(
        (p) => p.title.toLowerCase().includes(keyword) || p.projectType.toLowerCase().includes(keyword)
      )
    }

    // Status filter
    if (filters.statuses.length > 0) {
      result = result.filter((p) => filters.statuses.includes(p.status))
    }

    // Role filter
    if (filters.roles.length > 0) {
      result = result.filter((p) => filters.roles.includes(p.role))
    }

    // Year range filter
    if (filters.yearFrom !== MIN_YEAR || filters.yearTo !== CURRENT_YEAR) {
      result = result.filter((p) => {
        if (!p.projectYear) return false
        return p.projectYear >= filters.yearFrom && p.projectYear <= filters.yearTo
      })
    }

    return result
  }, [projects, filters])

  const hasActiveFilters =
    filters.keyword !== "" ||
    filters.statuses.length > 0 ||
    filters.roles.length > 0 ||
    filters.yearFrom !== MIN_YEAR ||
    filters.yearTo !== CURRENT_YEAR

  const handleApplyFilters = useCallback((newFilters: FilterState) => {
    setFilters(newFilters)
  }, [])

  const handleRemoveFilter = useCallback((filterType: string, value?: string) => {
    setFilters((prev) => {
      if (filterType === "keyword") {
        return { ...prev, keyword: "" }
      }
      if (filterType === "status" && value) {
        return { ...prev, statuses: prev.statuses.filter((s) => s !== value) }
      }
      if (filterType === "role" && value) {
        return { ...prev, roles: prev.roles.filter((r) => r !== value) }
      }
      if (filterType === "year") {
        return { ...prev, yearFrom: MIN_YEAR, yearTo: CURRENT_YEAR }
      }
      return prev
    })
  }, [])

  const handleClearAllFilters = useCallback(() => {
    setFilters({
      keyword: "",
      statuses: [],
      roles: [],
      yearFrom: MIN_YEAR,
      yearTo: CURRENT_YEAR,
    })
  }, [])

  const statusOptions = [
    {
      value: "Live on page",
      label: "Live on page",
      description: "Upgrade to add this project to your company page",
      color: "bg-green-500",
    },
    {
      value: "Listed",
      label: "Listed",
      description: "You are visible on the project page",
      color: "bg-green-500",
    },
    {
      value: "Unlisted",
      label: "Unlisted",
      description: "You won't be visible on the project page as contributor",
      color: "bg-gray-400",
    },
  ]

  const samplePhotos = Array.from({ length: 9 }, (_, i) => ({
    id: i,
    url: "/placeholder.svg",
  }))

  const displayedProjects = filteredProjects
  const hasProjects = projects.length > 0

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <DashboardHeader />

      <main className="flex-1 max-w-7xl mx-auto py-8 w-full px-4 md:px-6 lg:px-0">
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-gray-900 font-medium text-xl">Your projects</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage the listings you are creating and publishing on Arco.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="default"
                onClick={() => setIsFilterOpen(true)}
                className={hasActiveFilters ? "border-red-500 text-red-600 bg-red-50" : ""}
              >
                Filter
                {hasActiveFilters && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-red-600 text-white rounded-full">
                    {filters.statuses.length + filters.roles.length + (filters.keyword ? 1 : 0) + (filters.yearFrom !== MIN_YEAR || filters.yearTo !== CURRENT_YEAR ? 1 : 0)}
                  </span>
                )}
              </Button>
              <Button asChild>
                <Link href="/new-project/details">Add project</Link>
              </Button>
            </div>
          </div>

          {/* Filter Chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2">
              {filters.keyword && (
                <button
                  onClick={() => handleRemoveFilter("keyword")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                >
                  <span>&ldquo;{filters.keyword}&rdquo;</span>
                  <X className="h-3 w-3" />
                </button>
              )}
              {filters.statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => handleRemoveFilter("status", status)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                >
                  <span>{STATUS_CONFIG[status].label}</span>
                  <X className="h-3 w-3" />
                </button>
              ))}
              {filters.roles.map((role) => (
                <button
                  key={role}
                  onClick={() => handleRemoveFilter("role", role)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                >
                  <span>{role === "owner" ? "Project owner" : "Contributor"}</span>
                  <X className="h-3 w-3" />
                </button>
              ))}
              {(filters.yearFrom !== MIN_YEAR || filters.yearTo !== CURRENT_YEAR) && (
                <button
                  onClick={() => handleRemoveFilter("year")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                >
                  <span>
                    {filters.yearFrom}-{filters.yearTo}
                  </span>
                  <X className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={handleClearAllFilters}
                className="text-sm text-gray-600 hover:text-gray-900 underline ml-2"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {loadError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-64 rounded-lg bg-white shadow-sm animate-pulse overflow-hidden">
                <div className="h-40 bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : hasProjects ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedProjects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="relative">
                <img
                  src={project.coverImageUrl}
                  alt={project.title}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute top-3 left-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${project.statusChipClass}`}>
                    {project.statusLabel}
                  </span>
                </div>
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <span className="text-xs text-black bg-white px-2 py-1 rounded">Project owner</span>
                  <div className="relative">
                    <button
                      onClick={() => setOpenDropdown(openDropdown === project.id ? null : project.id)}
                      className="p-1 bg-white rounded-full shadow-sm hover:bg-gray-50"
                    >
                      <MoreHorizontal className="w-4 h-4 text-gray-600" />
                    </button>
                    {openDropdown === project.id && (
                      <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border py-2 w-40 z-10">
                        <button
                          onClick={() => handleUpdateStatus(project)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Update status
                        </button>
                        <button
                          onClick={() => handleEditCoverImage(project)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Edit cover image
                        </button>
                        <button
                          onClick={() => handleEditListing(project)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Edit listing
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-medium text-gray-900">{project.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{project.subtitle}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Created on {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <h2 className="text-lg font-medium text-gray-900">Add your first project</h2>
            <p className="text-sm text-gray-500 mt-2">
              Kick off your first listing to showcase your work and connect with professionals.
            </p>
            <div className="mt-6">
              <Button asChild>
                <Link href="/new-project/details">Create a project</Link>
              </Button>
            </div>
          </div>
        )}
      </main>

      {statusModalOpen && selectedProject && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Listing status</h2>
              <button onClick={() => setStatusModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <img
                src={selectedProject.coverImageUrl}
                alt={selectedProject.title}
                className="w-16 h-16 rounded-lg object-cover"
              />
              <div>
                <h3 className="font-medium text-gray-900">{selectedProject.title}</h3>
                <p className="text-sm text-gray-500">{selectedProject.subtitle}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {statusOptions.map((option) => (
                <label
                  key={option.value}
                  className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedStatus === option.value
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="status"
                      value={option.value}
                      checked={selectedStatus === option.value}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <div className={`w-2 h-2 rounded-full ${option.color}`} />
                      <div>
                        <div className="font-medium text-gray-900">{option.label}</div>
                        <div className="text-sm text-gray-500">{option.description}</div>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStatusModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveStatus} className="flex-1">
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {coverPhotoModalOpen && selectedProject && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Edit cover photo</h2>
              <button onClick={() => setCoverPhotoModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-6">
              This photo will be displayed with the project on your company portfolio
            </p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              {samplePhotos.map((photo) => (
                <div key={photo.id} className="relative cursor-pointer" onClick={() => setSelectedCoverPhoto(photo.id)}>
                  <img
                    src={photo.url || "/placeholder.svg"}
                    alt={`Cover option ${photo.id + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  {selectedCoverPhoto === photo.id && (
                    <div className="absolute top-2 right-2 bg-white rounded-full p-1">
                      <Check className="w-4 h-4 text-gray-900" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setCoverPhotoModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveCoverPhoto}>Save</Button>
            </div>
          </div>
        </div>
      )}

      <Footer />

      <DashboardListingsFilter
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={handleApplyFilters}
        currentFilters={filters}
      />
    </div>
  )
}
