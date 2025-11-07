"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"
import {
  ArrowUpDown,
  Ban,
  CheckCircle,
  Eye,
  ExternalLink,
  ListChecks,
  Globe,
  MoreHorizontal,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  UserCog,
} from "lucide-react"
import { toast } from "sonner"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"

import {
  changeProjectOwnerAction,
  deleteProjectAction,
  setProjectFeaturedAction,
  setProjectStatusAction,
} from "@/app/admin/projects/actions"
import { EditableSeoCell } from "@/components/editable-seo-cell"
import { calculateSeoStatus } from "@/lib/seo-utils"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
type ProjectStatusValue = "draft" | "in_progress" | "published" | "archived" | "rejected"

const STATUS_LABELS: Record<ProjectStatusValue, { label: string; tone: string }> = {
  draft: { label: "In progress", tone: "bg-amber-100 text-amber-800" },
  in_progress: { label: "In review", tone: "bg-blue-100 text-blue-800" },
  published: { label: "Published", tone: "bg-green-100 text-green-800" },
  archived: { label: "Unpublished", tone: "bg-surface text-text-secondary" },
  rejected: { label: "Rejected", tone: "bg-red-100 text-red-700" },
}

const STATUS_CHOICES: Array<{ value: ProjectStatusValue; label: string; description: string }> = [
  {
    value: "draft",
    label: "In progress",
    description: "Listing is still being prepared and is hidden from public pages.",
  },
  {
    value: "in_progress",
    label: "In review",
    description: "Listing awaits admin review before it can go live.",
  },
  {
    value: "published",
    label: "Published",
    description: "Listing is published and visible on the homeowner site.",
  },
  {
    value: "archived",
    label: "Unpublished",
    description: "Listing remains in the account but is hidden from public discovery.",
  },
  {
    value: "rejected",
    label: "Rejected",
    description: "Listing is rejected and the owner sees the provided reason.",
  },
]

const STATUS_VALUES = STATUS_CHOICES.map((status) => status.value) as ProjectStatusValue[]

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...STATUS_CHOICES.map((status) => ({ value: status.value, label: status.label })),
]

const PAGE_SIZE_OPTIONS = [10, 25, 50]

export type AdminProjectRow = {
  id: string
  title: string
  slug: string | null
  status: ProjectStatusValue
  projectType: string | null
  features: string[] | null
  projectYear: number | null
  createdAt: string | null
  isFeatured: boolean | null
  likesCount: number | null
  location: string | null
  addressFormatted?: string | null
  shareExactLocation?: boolean | null
  imageCount?: number | null
  primaryCategory?: string | null
  styles?: string[] | null
  seoTitle?: string | null
  seoDescription?: string | null
  seoStatus?: string | null
  statusUpdatedAt?: string | null
  statusUpdatedBy?: string | null
  rejectionReason?: string | null
}

interface AdminProjectsTableProps {
  projects: AdminProjectRow[]
}

type SortColumn =
  | "title"
  | "status"
  | "type"
  | "location"
  | "images"
  | "year"
  | "created"
  | "modified"
  | "likes"
  | "featured"

type SortDirection = "asc" | "desc"

export function AdminProjectsTable({ projects }: AdminProjectsTableProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [showSeoView, setShowSeoView] = useState(false)
  const [sortColumn, setSortColumn] = useState<SortColumn>("modified")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
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
  const [approvalModalProject, setApprovalModalProject] = useState<AdminProjectRow | null>(null)
  const [approvalProfessionals, setApprovalProfessionals] = useState<Array<{email: string, status: string, professional_id: string | null, is_project_owner?: boolean, company_name?: string}>>([]) 
  const [isLoadingProfessionals, setIsLoadingProfessionals] = useState(false)
  const [statusDialogProject, setStatusDialogProject] = useState<AdminProjectRow | null>(null)
  const [statusSelection, setStatusSelection] = useState<ProjectStatusValue>("draft")
  const [statusNote, setStatusNote] = useState("")
  const [isPending, startTransition] = useTransition()
  const [isApprovePending, startApproveTransition] = useTransition()
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0])
  const [seoUpdateTrigger, setSeoUpdateTrigger] = useState(0)

  const totalCount = projects.length

  useEffect(() => {
    if (!statusDialogProject) {
      return
    }

    const normalizedStatus = STATUS_VALUES.includes(statusDialogProject.status as ProjectStatusValue)
      ? (statusDialogProject.status as ProjectStatusValue)
      : "draft"

    startTransition(() => {
      setStatusSelection(normalizedStatus)
      setStatusNote(normalizedStatus === "rejected" ? statusDialogProject.rejectionReason ?? "" : "")
    })
  }, [statusDialogProject])

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

  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection(column === "modified" || column === "created" ? "desc" : "asc")
    }
  }, [sortColumn, sortDirection])

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

  const sortedProjects = useMemo(() => {
    const sorted = [...filteredProjects]

    sorted.sort((a, b) => {
      let comparison = 0

      switch (sortColumn) {
        case "title":
          comparison = a.title.localeCompare(b.title)
          break
        case "status":
          comparison = a.status.localeCompare(b.status)
          break
        case "type":
          comparison = (a.projectType || "").localeCompare(b.projectType || "")
          break
        case "location":
          comparison = (a.location || "").localeCompare(b.location || "")
          break
        case "images":
          comparison = (a.imageCount || 0) - (b.imageCount || 0)
          break
        case "year":
          comparison = (a.projectYear || 0) - (b.projectYear || 0)
          break
        case "created":
          comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
          break
        case "modified":
          const aModified = a.statusUpdatedAt || a.createdAt || ""
          const bModified = b.statusUpdatedAt || b.createdAt || ""
          comparison = new Date(aModified).getTime() - new Date(bModified).getTime()
          break
        case "likes":
          comparison = (a.likesCount || 0) - (b.likesCount || 0)
          break
        case "featured":
          comparison = (a.isFeatured ? 1 : 0) - (b.isFeatured ? 1 : 0)
          break
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

    return sorted
  }, [filteredProjects, sortColumn, sortDirection])

  const locationFilterKey = selectedLocations.join("|")
  const featureFilterKey = selectedFeatures.join("|")
  const styleFilterKey = selectedStyles.join("|")
  const typeFilterKey = selectedTypes.join("|")
  const subtypeFilterKey = selectedSubtypes.join("|")

  useEffect(() => {
    setPage(0)
  }, [
    search,
    statusFilter,
    featuredOnly,
    showSeoView,
    locationFilterKey,
    featureFilterKey,
    styleFilterKey,
    typeFilterKey,
    subtypeFilterKey,
    dateFrom,
    dateTo,
    minImages,
    maxImages,
  ])

  const pageCount = Math.max(1, Math.ceil(sortedProjects.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const pageItems = useMemo(
    () =>
      sortedProjects.slice(
        currentPage * pageSize,
        currentPage * pageSize + pageSize,
      ),
    [sortedProjects, currentPage, pageSize],
  )

  useEffect(() => {
    if (page !== currentPage) {
      setPage(currentPage)
    }
  }, [currentPage, page])

  const handleExportCsv = useCallback(() => {
    if (sortedProjects.length === 0) {
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

    const rows = sortedProjects.map((project) => {
      const base = [
        project.title,
        project.slug ?? "",
        STATUS_LABELS[project.status]?.label ?? project.status,
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
  }, [sortedProjects, showSeoView])

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
        toast.error("Unable to update featured status", { 
          description: result.error.message 
        })
      } else {
        if (result.warnings?.length) {
          result.warnings.forEach(warning => toast.warning(warning))
        }
        toast.success(`Project ${nextFeatured ? "added to" : "removed from"} featured list`)
      }
    })
  }

  const closeStatusDialog = () => {
    setStatusDialogProject(null)
    setStatusSelection("draft")
    setStatusNote("")
  }

  const handleApprove = async (project: AdminProjectRow) => {
    // Show modal and load professionals
    setApprovalModalProject(project)
    setIsLoadingProfessionals(true)
    
    try {
      // Load professionals for this project
      const supabase = getBrowserSupabaseClient()
      const { data: professionals } = await supabase
        .from('project_professionals')
        .select(`
          invited_email, 
          status, 
          professional_id,
          is_project_owner,
          professionals(
            companies(name)
          )
        `)
        .eq('project_id', project.id)
      
      const processedProfessionals = (professionals || []).map(prof => ({
        email: prof.invited_email,
        status: prof.status,
        professional_id: prof.professional_id,
        is_project_owner: prof.is_project_owner,
        company_name: prof.professionals?.companies?.name || null
      }))
      
      setApprovalProfessionals(processedProfessionals)
    } catch (error) {
      console.error('Failed to load professionals:', error)
      setApprovalProfessionals([])
    } finally {
      setIsLoadingProfessionals(false)
    }
  }

  const handleApprovalModalConfirm = () => {
    if (!approvalModalProject) return
    
    startApproveTransition(async () => {
      const result = await setProjectStatusAction({ 
        projectId: approvalModalProject.id, 
        status: "published" 
      })

      if (!result.success) {
        toast.error("Unable to approve project", { 
          description: result.error.message 
        })
        return
      }

      toast.success("Project approved and published")
      setApprovalModalProject(null)
    })
  }

  const handleRejectShortcut = (project: AdminProjectRow) => {
    setStatusDialogProject({ ...project, status: "rejected" })
    setStatusSelection("rejected")
    setStatusNote(project.rejectionReason ?? "")
  }

  const handleStatusSubmit = () => {
    if (!statusDialogProject) {
      return
    }

    if (statusSelection === "rejected" && statusNote.trim().length === 0) {
      toast.error("Rejection reason is required")
      return
    }

    startTransition(async () => {
      const result = await setProjectStatusAction({
        projectId: statusDialogProject.id,
        status: statusSelection,
        rejectionReason: statusSelection === "rejected" ? statusNote.trim() : undefined,
      })

      if (!result.success) {
        toast.error("Unable to update status", { 
          description: result.error.message 
        })
        return
      }

      if (result.warnings?.length) {
        result.warnings.forEach(warning => toast.warning(warning))
      }
      toast.success(`Status updated to ${STATUS_LABELS[statusSelection].label}`)
      closeStatusDialog()
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
        toast.error("Unable to change owner", { 
          description: result.error.message 
        })
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
        toast.error("Unable to delete project", { 
          description: result.error.message 
        })
        return
      }

      toast.success("Project deleted")
      setDeleteProject(null)
    })
  }

  const handleSeoUpdate = () => {
    setSeoUpdateTrigger(prev => prev + 1)
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
          <Button variant="quaternary" size="quaternary" onClick={() => handleFilterDialogChange(true)}>
            Filters
            {activeFiltersCount > 0 && <Badge variant="secondary" className="ml-2">{activeFiltersCount}</Badge>}
          </Button>
          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
            <Label htmlFor="seo-view-toggle" className="font-medium">
              SEO view
            </Label>
            <Switch id="seo-view-toggle" checked={showSeoView} onCheckedChange={setShowSeoView} />
          </div>
          <Button variant="quaternary" size="quaternary" onClick={handleExportCsv}>Export CSV</Button>
          <Button asChild variant="secondary">
            <Link href="/new-project/details">
              <Sparkles className="mr-2 h-4 w-4" />
              Add project
            </Link>
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {showSeoView ? (
                <>
                  <TableHead className="w-auto whitespace-nowrap">Slug</TableHead>
                  <TableHead className="w-auto">Meta title</TableHead>
                  <TableHead className="w-auto">Meta description</TableHead>
                  <TableHead className="w-auto whitespace-nowrap">SEO status</TableHead>
                  <TableHead className="w-[50px]" />
                </>
              ) : (
                <>
                  <TableHead className="w-[80px] text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("featured")}
                    >
                      Featured
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("title")}
                    >
                      Project
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Features</TableHead>
                  <TableHead className="w-[160px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("location")}
                    >
                      Location
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[90px] text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("images")}
                    >
                      Images
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[80px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("year")}
                    >
                      Year
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[140px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("created")}
                    >
                      Created
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[140px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("modified")}
                    >
                      Modified
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[120px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("status")}
                    >
                      Status
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[80px] text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort("likes")}
                    >
                      Likes
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[70px]" />
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showSeoView ? 5 : 11} className="py-10 text-center text-sm text-muted-foreground">
                  No projects match your filters.
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((project) => {
                const features = project.features ?? []
                const featurePreview = features.slice(0, 5)
                const remainingCount = Math.max(features.length - featurePreview.length, 0)
                const statusInfo = STATUS_LABELS[project.status] ?? {
                  label: project.status,
                  tone: "bg-muted",
                }
                const imageCount = project.imageCount ?? 0
                const isPreviewMode = project.status === "draft" || project.status === "in_progress"
                const previewSuffix = isPreviewMode ? "?preview=1" : ""
                const projectHref = project.slug ? `/projects/${project.slug}${previewSuffix}` : "#"

                const subTypeLabel = project.projectType || "Sub-type unavailable"
                const locationSummary = project.location?.trim() || "Location unknown"
                const preciseLocation = project.addressFormatted?.trim() || null
                const showPreciseLocation = Boolean(preciseLocation && preciseLocation !== locationSummary)

                if (showSeoView) {
                  const dynamicSeoStatus = calculateSeoStatus({
                    slug: project.slug,
                    seoTitle: project.seoTitle,
                    seoDescription: project.seoDescription
                  })

                  return (
                    <TableRow key={project.id} className={cn(isPending && "opacity-70")}> 
                      <TableCell className="align-top whitespace-nowrap pr-6">
                        <div className="space-y-1 min-w-[200px]">
                          <EditableSeoCell
                            projectId={project.id}
                            projectTitle={project.title}
                            field="slug"
                            value={project.slug}
                            onUpdate={handleSeoUpdate}
                          />
                          {project.slug && (
                            <Link
                              href={projectHref}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                              View page <ExternalLink className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top pr-6">
                        <div className="min-w-[250px] max-w-[350px]">
                          <EditableSeoCell
                            projectId={project.id}
                            projectTitle={project.title}
                            field="seoTitle"
                            value={project.seoTitle}
                            onUpdate={handleSeoUpdate}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="align-top pr-6">
                        <div className="min-w-[300px] max-w-[500px]">
                          <EditableSeoCell
                            projectId={project.id}
                            projectTitle={project.title}
                            field="seoDescription"
                            value={project.seoDescription}
                            onUpdate={handleSeoUpdate}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="align-top whitespace-nowrap">
                        <span className={cn(
                          "inline-flex items-center gap-1 text-sm rounded-md px-2 py-1 font-medium",
                          dynamicSeoStatus === 'Ready' && "bg-green-100 text-green-800",
                          dynamicSeoStatus === 'Partial' && "bg-amber-100 text-amber-800",
                          dynamicSeoStatus === 'Missing' && "bg-red-100 text-red-800"
                        )}>
                          <Globe className="h-4 w-4" />
                          {dynamicSeoStatus}
                        </span>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            {project.status === "in_progress" && (
                              <>
                                <DropdownMenuItem
                                  onSelect={() => handleApprove(project)}
                                  disabled={isApprovePending}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" /> Approve & publish
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleRejectShortcut(project)}>
                                  <Ban className="mr-2 h-4 w-4 text-red-600" />
                                  <span className="text-red-600">Reject</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                          <DropdownMenuItem asChild>
                            <Link href={projectHref} target="_blank">
                                <Eye className="mr-2 h-4 w-4" /> View live page
                              </Link>
                          </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/new-project/details?projectId=${project.id}`}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit project
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setStatusDialogProject(project)}>
                              <ListChecks className="mr-2 h-4 w-4" /> Update status
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
                          <Badge key={feature} variant="quaternary" size="quaternary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                        {remainingCount > 0 && (
                          <Badge variant="secondary" className="text-xs">+{remainingCount}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span className={showPreciseLocation ? "text-foreground" : "text-muted-foreground"}>
                          {preciseLocation ?? locationSummary}
                        </span>
                        {showPreciseLocation && (
                          <span className="text-xs text-muted-foreground">{locationSummary}</span>
                        )}
                        {!project.shareExactLocation && (
                          <span className="text-xs text-amber-600">Exact address hidden from public</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm">{project.imageCount ?? 0}</TableCell>
                    <TableCell>{project.projectYear ?? "—"}</TableCell>
                    <TableCell>
                      {project.createdAt ? format(new Date(project.createdAt), "PP") : "—"}
                    </TableCell>
                    <TableCell>
                      {project.statusUpdatedAt || project.createdAt
                        ? format(new Date(project.statusUpdatedAt || project.createdAt!), "PP")
                        : "—"}
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
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          {project.status === "in_progress" && (
                            <>
                              <DropdownMenuItem
                                onSelect={() => handleApprove(project)}
                                disabled={isApprovePending}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" /> Approve & publish
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleRejectShortcut(project)}>
                                <Ban className="mr-2 h-4 w-4 text-red-600" />
                                <span className="text-red-600">Reject</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem asChild>
                            <Link href={projectHref} target="_blank">
                              <ExternalLink className="mr-2 h-4 w-4" /> View live page
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/new-project/details?projectId=${project.id}`}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit project
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setStatusDialogProject(project)}>
                            <ListChecks className="mr-2 h-4 w-4" /> Update status
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

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div>
          Showing {pageItems.length} of {filteredProjects.length} filtered projects ({totalCount} total)
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="projects-rows" className="text-sm font-medium text-foreground">
              Rows per page
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setPage(0)
              }}
            >
              <SelectTrigger id="projects-rows" className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="quaternary" size="quaternary"
              className="h-8"
              onClick={() => setPage(0)}
              disabled={currentPage === 0}
            >
              First
            </Button>
            <Button
              variant="quaternary" size="quaternary"
              className="h-8"
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
            >
              Prev
            </Button>
            <span className="px-2">
              Page {currentPage + 1} of {pageCount}
            </span>
            <Button
              variant="quaternary" size="quaternary"
              className="h-8"
              onClick={() => setPage((prev) => Math.min(pageCount - 1, prev + 1))}
              disabled={currentPage + 1 >= pageCount}
            >
              Next
            </Button>
            <Button
              variant="quaternary" size="quaternary"
              className="h-8"
              onClick={() => setPage(pageCount - 1)}
              disabled={currentPage + 1 >= pageCount}
            >
              Last
            </Button>
          </div>
        </div>
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
            <Button variant="quaternary" size="quaternary" onClick={handleClearFilters}>
              Clear all
            </Button>
            <div className="flex gap-2">
              <Button variant="quaternary" size="quaternary" onClick={() => handleFilterDialogChange(false)}>
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
              variant="quaternary" size="quaternary"
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
        open={Boolean(statusDialogProject)}
        onOpenChange={(open) => {
          if (!open) {
            closeStatusDialog()
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update project status</DialogTitle>
            <DialogDescription>
              Choose how &ldquo;{statusDialogProject?.title ?? "this project"}&rdquo; should appear across the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {statusDialogProject?.statusUpdatedAt && (
              <p className="text-xs text-muted-foreground">
                Last updated {formatDistanceToNow(new Date(statusDialogProject.statusUpdatedAt), { addSuffix: true })}
              </p>
            )}
            <RadioGroup value={statusSelection} onValueChange={(value) => setStatusSelection(value as ProjectStatusValue)}>
              {STATUS_CHOICES.map((choice) => (
                <label
                  key={choice.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                    statusSelection === choice.value ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary"
                  )}
                >
                  <RadioGroupItem value={choice.value} className="mt-1" />
                  <div className="space-y-1">
                    <p className="font-medium leading-none">{choice.label}</p>
                    <p className="text-sm text-muted-foreground">{choice.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
            {statusSelection === "rejected" && (
              <div className="space-y-2">
                <Label htmlFor="status-rejection-reason">Rejection reason</Label>
                <Textarea
                  id="status-rejection-reason"
                  value={statusNote}
                  onChange={(event) => setStatusNote(event.target.value)}
                  placeholder="Share why this listing is rejected. The professional sees this message."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  This note is emailed to the project owner and appears in their dashboard.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="quaternary" size="quaternary" onClick={closeStatusDialog}>
              Cancel
            </Button>
            <Button onClick={handleStatusSubmit} disabled={isPending}>
              {isPending ? "Updating..." : "Update status"}
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
              variant="quaternary" size="quaternary"
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

      {/* Approval Modal */}
      <Dialog
        open={Boolean(approvalModalProject)}
        onOpenChange={(open) => {
          if (!open) {
            setApprovalModalProject(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve & publish project</DialogTitle>
            <DialogDescription>
              Review professionals invited to &ldquo;{approvalModalProject?.title ?? "this project"}&rdquo; before publishing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isLoadingProfessionals ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-pulse text-sm text-muted-foreground">Loading professionals...</div>
              </div>
            ) : approvalProfessionals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No professionals invited to this project.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium">Professionals ({approvalProfessionals.length})</p>
                <div className="space-y-2">
                  {approvalProfessionals.map((professional, index) => (
                    <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium leading-none">
                          {professional.professional_id && professional.company_name 
                            ? professional.company_name 
                            : professional.email
                          }
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {professional.email}
                        </p>
                      </div>
                      <Badge
                        variant="quaternary" size="quaternary"
                        className={`text-xs ${
                          professional.is_project_owner
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : professional.status === 'listed'
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : professional.status === 'live_on_page'
                            ? 'bg-teal-100 text-teal-800 border-teal-200'
                            : professional.status === 'unlisted'
                            ? 'bg-surface text-foreground border-border'
                            : professional.status === 'rejected'
                            ? 'bg-red-100 text-red-800 border-red-200'
                            : 'bg-blue-100 text-blue-800 border-blue-200'
                        }`}
                      >
                        {professional.is_project_owner
                          ? 'Project owner'
                          : professional.status === 'listed'
                          ? 'Published'
                          : professional.status === 'live_on_page'
                          ? 'Featured'
                          : professional.status === 'unlisted'
                          ? 'Unpublished'
                          : professional.status === 'rejected'
                          ? 'Declined'
                          : 'Invited'
                        }
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="quaternary" size="quaternary" 
              onClick={() => setApprovalModalProject(null)} 
              disabled={isApprovePending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleApprovalModalConfirm} 
              disabled={isApprovePending}
            >
              {isApprovePending ? "Publishing..." : "Publish project"}
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
