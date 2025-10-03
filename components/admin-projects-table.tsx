"use client"

import { useCallback, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
  AlertTriangle,
  Check,
  Clock,
  Eye,
  ExternalLink,
  Globe,
  MoreHorizontal,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  UserCog,
} from "lucide-react"
import { toast } from "sonner"

import {
  changeProjectOwnerAction,
  deleteProjectAction,
  setProjectFeaturedAction,
  setProjectStatusAction,
} from "@/app/admin/projects/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-slate-200 text-slate-700" },
  in_progress: { label: "In review", tone: "bg-blue-100 text-blue-800" },
  published: { label: "Live", tone: "bg-green-100 text-green-800" },
  completed: { label: "Listed", tone: "bg-emerald-100 text-emerald-800" },
  archived: { label: "Archived", tone: "bg-neutral-200 text-neutral-700" },
}

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "in_progress", label: "In review" },
  { value: "published", label: "Live" },
  { value: "completed", label: "Listed" },
  { value: "archived", label: "Archived" },
]

export type AdminProjectRow = {
  id: string
  title: string
  slug: string | null
  status: string
  projectType: string | null
  features: string[] | null
  projectYear: number | null
  createdAt: string | null
  isFeatured: boolean | null
  likesCount: number | null
  location: string | null
  imageCount?: number | null
  primaryCategory?: string | null
  styles?: string[] | null
  seoTitle?: string | null
  seoDescription?: string | null
  seoStatus?: string | null
}

interface AdminProjectsTableProps {
  projects: AdminProjectRow[]
}

export function AdminProjectsTable({ projects }: AdminProjectsTableProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [showSeoView, setShowSeoView] = useState(false)
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedSubtypes, setSelectedSubtypes] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [minImages, setMinImages] = useState<string>("")
  const [maxImages, setMaxImages] = useState<string>("")
  const [changeOwnerProject, setChangeOwnerProject] = useState<AdminProjectRow | null>(null)
  const [changeOwnerEmail, setChangeOwnerEmail] = useState("")
  const [isChangingOwner, startChangeOwnerTransition] = useTransition()
  const [deleteProject, setDeleteProject] = useState<AdminProjectRow | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isPending, startTransition] = useTransition()
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)

  const totalCount = projects.length

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (statusFilter !== "all") count += 1
    if (featuredOnly) count += 1
    count +=
      selectedLocations.length +
      selectedFeatures.length +
      selectedStyles.length +
      selectedTypes.length +
      selectedSubtypes.length
    if (dateFrom) count += 1
    if (dateTo) count += 1
    if (minImages) count += 1
    if (maxImages) count += 1
    return count
  }, [
    statusFilter,
    featuredOnly,
    selectedLocations,
    selectedFeatures,
    selectedStyles,
    selectedTypes,
    selectedSubtypes,
    dateFrom,
    dateTo,
    minImages,
    maxImages,
  ])

  type FilterSnapshot = {
    statusFilter: string
    featuredOnly: boolean
    selectedLocations: string[]
    selectedFeatures: string[]
    selectedStyles: string[]
    selectedTypes: string[]
    selectedSubtypes: string[]
    dateFrom: string
    dateTo: string
    minImages: string
    maxImages: string
  }

  const filterSnapshotRef = useRef<FilterSnapshot | null>(null)

  const availableLocations = useMemo(() => {
    const values = new Set<string>()
    projects.forEach((project) => {
      const value = project.location?.trim() || "Unknown"
      values.add(value)
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [projects])

  const toggleValue = useCallback((value: string, selected: string[], setter: (next: string[]) => void) => {
    setter(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])
  }, [])

  const handleClearFilters = () => {
    setStatusFilter("all")
    setFeaturedOnly(false)
    setSelectedLocations([])
    setSelectedFeatures([])
    setSelectedStyles([])
    setSelectedTypes([])
    setSelectedSubtypes([])
    setDateFrom("")
    setDateTo("")
    setMinImages("")
    setMaxImages("")
  }

  const availableFeatures = useMemo(() => {
    const values = new Set<string>()
    projects.forEach((project) => {
      ;(project.features ?? []).forEach((feature) => {
        if (feature) values.add(feature)
      })
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [projects])

  const availableStyles = useMemo(() => {
    const values = new Set<string>()
    projects.forEach((project) => {
      ;(project.styles ?? []).forEach((style) => {
        if (style) values.add(style)
      })
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [projects])

  const availableTypes = useMemo(() => {
    const values = new Set<string>()
    projects.forEach((project) => {
      if (project.primaryCategory) {
        values.add(project.primaryCategory)
      }
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [projects])

  const availableSubtypes = useMemo(() => {
    const values = new Set<string>()
    projects.forEach((project) => {
      if (project.projectType) {
        values.add(project.projectType)
      }
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [projects])

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase()
    const fromDate = dateFrom ? new Date(dateFrom) : null
    const toDate = dateTo ? new Date(dateTo) : null
    const minImagesCount = minImages ? Number(minImages) : null
    const maxImagesCount = maxImages ? Number(maxImages) : null

    return projects.filter((project) => {
      const matchesSearch = (() => {
        if (!query) return true
        if (showSeoView) {
          return (
            project.slug?.toLowerCase().includes(query) ||
            project.seoTitle?.toLowerCase().includes(query) ||
            project.seoDescription?.toLowerCase().includes(query)
          )
        }
        return (
          project.title.toLowerCase().includes(query) ||
          project.slug?.toLowerCase().includes(query) ||
          project.projectType?.toLowerCase().includes(query) ||
          (project.features ?? []).some((feature) => feature.toLowerCase().includes(query))
        )
      })()

      const matchesStatus = statusFilter === "all" ? true : project.status === statusFilter
      const matchesFeatured = featuredOnly ? project.isFeatured === true : true

      const locationLabel = project.location?.trim() || "Unknown"
      const matchesLocation =
        selectedLocations.length === 0 || selectedLocations.includes(locationLabel)

      const matchesFeatures =
        selectedFeatures.length === 0 ||
        (project.features ?? []).some((feature) => selectedFeatures.includes(feature ?? ""))

      const matchesStyles =
        selectedStyles.length === 0 ||
        (project.styles ?? []).some((style) => selectedStyles.includes(style ?? ""))

      const matchesTypes =
        selectedTypes.length === 0 ||
        selectedTypes.includes(project.primaryCategory ?? "")

      const matchesSubtypes =
        selectedSubtypes.length === 0 ||
        selectedSubtypes.includes(project.projectType ?? "")

      const createdAt = project.createdAt ? new Date(project.createdAt) : null
      const imageCount = project.imageCount ?? 0
      const matchesImages = (() => {
        if (minImagesCount === null && maxImagesCount === null) return true
        if (minImagesCount !== null && !Number.isNaN(minImagesCount) && imageCount < minImagesCount) {
          return false
        }
        if (maxImagesCount !== null && !Number.isNaN(maxImagesCount) && imageCount > maxImagesCount) {
          return false
        }
        return true
      })()
      const matchesDate = (() => {
        if (!fromDate && !toDate) return true
        if (!createdAt) return false
        if (fromDate && createdAt < fromDate) return false
        if (toDate) {
          const endOfDay = new Date(toDate)
          endOfDay.setHours(23, 59, 59, 999)
          if (createdAt > endOfDay) return false
        }
        return true
      })()

      return (
        matchesSearch &&
        matchesStatus &&
        matchesFeatured &&
        matchesLocation &&
        matchesFeatures &&
        matchesStyles &&
        matchesTypes &&
        matchesSubtypes &&
        matchesImages &&
        matchesDate
      )
    })
  }, [
    projects,
    search,
    statusFilter,
    featuredOnly,
    showSeoView,
    selectedLocations,
    selectedFeatures,
    selectedStyles,
    selectedTypes,
    selectedSubtypes,
    dateFrom,
    dateTo,
    minImages,
    maxImages,
  ])

  const handleExportCsv = useCallback(() => {
    if (filteredProjects.length === 0) {
      toast.error("No projects to export")
      return
    }

    const headers = showSeoView
      ? [
          "Title",
          "Slug",
          "Status",
          "Type",
          "Sub-type",
          "Location",
          "Likes",
          "Images",
          "Year",
          "Created",
          "Featured",
          "SEO Title",
          "SEO Description",
          "SEO Status",
        ]
      : [
          "Title",
          "Slug",
          "Status",
          "Type",
          "Sub-type",
          "Location",
          "Likes",
          "Images",
          "Year",
          "Created",
          "Featured",
        ]

    const escape = (value: unknown) => {
      const stringValue = value ?? ""
      return `"${String(stringValue).replace(/"/g, '""')}"`
    }

    const rows = filteredProjects.map((project) => {
      const base = [
        project.title,
        project.slug ?? "",
        project.status,
        project.primaryCategory ?? "",
        project.projectType ?? "",
        project.location ?? "",
        project.likesCount ?? 0,
        project.imageCount ?? 0,
        project.projectYear ?? "",
        project.createdAt ? format(new Date(project.createdAt), "yyyy-MM-dd") : "",
        project.isFeatured ? "Yes" : "No",
      ]

      if (showSeoView) {
        base.push(project.seoTitle ?? "")
        base.push(project.seoDescription ?? "")
        base.push(project.seoStatus ?? "")
      }

      return base.map(escape).join(",")
    })

    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = showSeoView ? "admin-projects-seo.csv" : "admin-projects.csv"
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success("Export generated")
  }, [filteredProjects, showSeoView])

  const handleFilterDialogChange = (open: boolean) => {
    if (open) {
      filterSnapshotRef.current = {
        statusFilter,
        featuredOnly,
        selectedLocations: [...selectedLocations],
        selectedFeatures: [...selectedFeatures],
        selectedStyles: [...selectedStyles],
        selectedTypes: [...selectedTypes],
        selectedSubtypes: [...selectedSubtypes],
        dateFrom,
        dateTo,
        minImages,
        maxImages,
      }
      setIsFilterDialogOpen(true)
      return
    }

    // Closing without applying should restore previous snapshot
    if (filterSnapshotRef.current) {
      const snapshot = filterSnapshotRef.current
      setStatusFilter(snapshot.statusFilter)
      setFeaturedOnly(snapshot.featuredOnly)
      setSelectedLocations(snapshot.selectedLocations)
      setSelectedFeatures(snapshot.selectedFeatures)
      setSelectedStyles(snapshot.selectedStyles)
      setSelectedTypes(snapshot.selectedTypes)
      setSelectedSubtypes(snapshot.selectedSubtypes)
      setDateFrom(snapshot.dateFrom)
      setDateTo(snapshot.dateTo)
      setMinImages(snapshot.minImages)
      setMaxImages(snapshot.maxImages)
    }

    filterSnapshotRef.current = null
    setIsFilterDialogOpen(false)
  }

  const handleApplyFilters = () => {
    filterSnapshotRef.current = null
    setIsFilterDialogOpen(false)
  }

  const handleToggleFeatured = (project: AdminProjectRow, nextFeatured: boolean) => {
    if (project.status !== "published" && nextFeatured) {
      toast.error("Only live projects can be featured")
      return
    }

    startTransition(async () => {
      const result = await setProjectFeaturedAction({ projectId: project.id, featured: nextFeatured })
      if (!result.success) {
        toast.error("Unable to update featured status", { description: result.error })
      } else {
        toast.success(`Project ${nextFeatured ? "added to" : "removed from"} featured list`)
      }
    })
  }

  const handleStatusChange = (project: AdminProjectRow, nextStatus: string) => {
    startTransition(async () => {
      const result = await setProjectStatusAction({ projectId: project.id, status: nextStatus as any })
      if (!result.success) {
        toast.error("Unable to update status", { description: result.error })
      } else {
        toast.success(`Status updated to ${STATUS_LABELS[nextStatus]?.label ?? nextStatus}`)
      }
    })
  }

  const handleChangeOwnerSubmit = () => {
    if (!changeOwnerProject || !changeOwnerEmail.trim()) return

    startChangeOwnerTransition(async () => {
      const result = await changeProjectOwnerAction({
        projectId: changeOwnerProject.id,
        ownerEmail: changeOwnerEmail.trim(),
      })

      if (!result.success) {
        toast.error("Unable to change owner", { description: result.error })
        return
      }

      toast.success("Project owner updated")
      setChangeOwnerProject(null)
      setChangeOwnerEmail("")
    })
  }

  const handleDeleteProject = () => {
    if (!deleteProject) return

    startDeleteTransition(async () => {
      const result = await deleteProjectAction({ projectId: deleteProject.id })
      if (!result.success) {
        toast.error("Unable to delete project", { description: result.error })
        return
      }

      toast.success("Project deleted")
      setDeleteProject(null)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex w-full flex-1 gap-2 md:w-auto md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={showSeoView ? "Search slug or meta data" : "Search by title, slug, or feature"}
            className="min-w-[240px] pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleFilterDialogChange(true)}>
            Filters
            {activeFiltersCount > 0 && <Badge variant="secondary" className="ml-2">{activeFiltersCount}</Badge>}
          </Button>
          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
            <Label htmlFor="seo-view-toggle" className="font-medium">
              SEO view
            </Label>
            <Switch id="seo-view-toggle" checked={showSeoView} onCheckedChange={setShowSeoView} />
          </div>
          <Button variant="outline" onClick={handleExportCsv}>Export CSV</Button>
          <Button asChild>
            <Link href="/new-project/details">
              <Sparkles className="mr-2 h-4 w-4" />
              Add project
            </Link>
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {showSeoView ? (
                <>
                  <TableHead className="w-[220px]">Slug</TableHead>
                  <TableHead>Meta title</TableHead>
                  <TableHead>Meta description</TableHead>
                  <TableHead className="w-[140px]">SEO status</TableHead>
                  <TableHead className="w-[70px]" />
                </>
              ) : (
                <>
                  <TableHead className="w-[80px] text-center">Featured</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Features</TableHead>
                  <TableHead className="w-[160px]">Location</TableHead>
                  <TableHead className="w-[90px] text-center">Images</TableHead>
                  <TableHead className="w-[80px]">Year</TableHead>
                  <TableHead className="w-[140px]">Created</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[80px] text-right">Likes</TableHead>
                  <TableHead className="w-[70px]" />
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showSeoView ? 5 : 10} className="py-10 text-center text-sm text-muted-foreground">
                  No projects match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredProjects.map((project) => {
                const features = project.features ?? []
                const featurePreview = features.slice(0, 5)
                const remainingCount = Math.max(features.length - featurePreview.length, 0)
                const statusInfo = STATUS_LABELS[project.status] ?? { label: project.status, tone: "bg-muted" }
                const imageCount = project.imageCount ?? 0

                const subTypeLabel = project.projectType || "Sub-type unavailable"
                const locationLabel = project.location ?? "Location unknown"

                if (showSeoView) {
                  return (
                    <TableRow key={project.id} className={cn(isPending && "opacity-70")}> 
                      <TableCell>
                        {project.slug ? (
                          <Link
                            href={`/projects/${project.slug}`}
                            target="_blank"
                            className="flex items-center gap-2 font-medium text-blue-600 hover:underline"
                          >
                            {project.slug}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Slug missing</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {project.seoTitle ? (
                          <span className="font-medium">{project.seoTitle}</span>
                        ) : (
                          <span className="text-muted-foreground">Meta title not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {project.seoDescription ? (
                          <span className="text-sm text-muted-foreground line-clamp-2">{project.seoDescription}</span>
                        ) : (
                          <span className="text-muted-foreground">Meta description not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Globe className="h-4 w-4" />
                          {project.seoStatus ?? "Unknown"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link href={project.slug ? `/projects/${project.slug}` : "#"} target="_blank">
                                <Eye className="mr-2 h-4 w-4" /> View live page
                              </Link>
                            </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/new-project/details?projectId=${project.id}`}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit project
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => {
                              setChangeOwnerProject(project)
                              setChangeOwnerEmail("")
                            }}
                          >
                            <UserCog className="mr-2 h-4 w-4" /> Change owner
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setDeleteProject(project)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
                }

                return (
                  <TableRow key={project.id} className={cn(isPending && "opacity-70")}> 
                    <TableCell className="text-center">
                      <Switch
                        checked={project.isFeatured ?? false}
                        onCheckedChange={(checked) => handleToggleFeatured(project, checked)}
                        disabled={isPending || project.status !== "published"}
                      />
                      {project.status !== "published" && (
                        <p className="mt-1 text-xs text-muted-foreground">Live projects only</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        {project.slug ? (
                          <Link
                            href={`/projects/${project.slug}`}
                            target="_blank"
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {project.title}
                          </Link>
                        ) : (
                          <span className="font-medium">{project.title}</span>
                        )}
                        <span className="text-sm text-muted-foreground">{subTypeLabel}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {featurePreview.map((feature) => (
                          <Badge key={feature} variant="outline" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                        {remainingCount > 0 && (
                          <Badge variant="secondary" className="text-xs">+{remainingCount}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {locationLabel}
                    </TableCell>
                    <TableCell className="text-center text-sm">{project.imageCount ?? 0}</TableCell>
                    <TableCell>{project.projectYear ?? "—"}</TableCell>
                    <TableCell>
                      {project.createdAt ? format(new Date(project.createdAt), "PP") : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={cn("rounded-md px-2 py-1 text-xs font-medium", statusInfo.tone)}>
                        {statusInfo.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{project.likesCount ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <Link href={project.slug ? `/projects/${project.slug}` : "#"} target="_blank">
                                <Eye className="mr-2 h-4 w-4" /> View live page
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/new-project/details?projectId=${project.id}`}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit project
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => handleStatusChange(project, "published")}>
                            <Check className="mr-2 h-4 w-4" /> Mark as Live
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleStatusChange(project, "in_progress")}>
                            <Clock className="mr-2 h-4 w-4" /> Send to review
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleStatusChange(project, "archived")}>
                            <AlertTriangle className="mr-2 h-4 w-4" /> Archive
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={project.slug ? `/projects/${project.slug}` : "#"} target="_blank">
                              <ExternalLink className="mr-2 h-4 w-4" /> Open in new tab
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => {
                              setChangeOwnerProject(project)
                              setChangeOwnerEmail("")
                            }}
                          >
                            <UserCog className="mr-2 h-4 w-4" /> Change owner
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setDeleteProject(project)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end text-sm text-muted-foreground">
        Showing {filteredProjects.length} / {totalCount}
      </div>

      <Dialog
        open={isFilterDialogOpen}
        onOpenChange={handleFilterDialogChange}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
            <DialogDescription>Select filters to narrow down the admin project list.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status-filter">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status-filter">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Switch checked={featuredOnly} onCheckedChange={setFeaturedOnly} id="featured-filter" />
                <label htmlFor="featured-filter" className="text-sm font-medium">
                  Featured only
                </label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-from">Created from</Label>
                <Input id="date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-to">Created to</Label>
                <Input id="date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Images</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="Min"
                    value={minImages}
                    onChange={(event) => setMinImages(event.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="Max"
                    value={maxImages}
                    onChange={(event) => setMaxImages(event.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <FilterCheckboxList
                label="Locations"
                options={availableLocations}
                selected={selectedLocations}
                onToggle={(option) => toggleValue(option, selectedLocations, setSelectedLocations)}
              />
              <FilterCheckboxList
                label="Features"
                options={availableFeatures}
                selected={selectedFeatures}
                onToggle={(option) => toggleValue(option, selectedFeatures, setSelectedFeatures)}
              />
              <FilterCheckboxList
                label="Styles"
                options={availableStyles}
                selected={selectedStyles}
                onToggle={(option) => toggleValue(option, selectedStyles, setSelectedStyles)}
              />
              <FilterCheckboxList
                label="Types"
                options={availableTypes}
                selected={selectedTypes}
                onToggle={(option) => toggleValue(option, selectedTypes, setSelectedTypes)}
              />
              <FilterCheckboxList
                label="Sub-types"
                options={availableSubtypes}
                selected={selectedSubtypes}
                onToggle={(option) => toggleValue(option, selectedSubtypes, setSelectedSubtypes)}
              />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button variant="outline" onClick={handleClearFilters}>
              Clear all
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleFilterDialogChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleApplyFilters}>Apply filters</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(changeOwnerProject)}
        onOpenChange={(open) => {
          if (!open) {
            setChangeOwnerProject(null)
            setChangeOwnerEmail("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change project owner</DialogTitle>
            <DialogDescription>
              Assign a new professional owner for &ldquo;{changeOwnerProject?.title ?? "this project"}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-owner-email">Owner email</Label>
              <Input
                id="new-owner-email"
                type="email"
                value={changeOwnerEmail}
                onChange={(event) => setChangeOwnerEmail(event.target.value)}
                placeholder="professional@example.com"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              The new owner must be a verified professional. They will immediately gain access to manage the project.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setChangeOwnerProject(null)
                setChangeOwnerEmail("")
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleChangeOwnerSubmit} disabled={!changeOwnerEmail || isChangingOwner}>
              {isChangingOwner ? "Updating..." : "Change owner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteProject)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteProject(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              This action permanently removes &ldquo;{deleteProject?.title ?? "this project"}&rdquo; and its related data. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteProject(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProject} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterCheckboxList({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (option: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid max-h-40 gap-2 overflow-y-auto rounded-md border p-2">
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">No options</p>
        ) : (
          options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <Checkbox checked={selected.includes(option)} onCheckedChange={() => onToggle(option)} />
              <span className="flex-1 truncate">{option}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}
