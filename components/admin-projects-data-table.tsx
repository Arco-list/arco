"use client"

import { Fragment, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreHorizontal,
  Star,
} from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"

import {
  setProjectStatusAction,
  deleteProjectAction,
  updateProjectProfessionalStatusAction,
  toggleProjectFeaturedAction,
} from "@/app/admin/projects/actions"
import { generateCompanyLoginLinkAction } from "@/app/admin/professionals/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ProjectStatus = "draft" | "in_progress" | "published" | "completed" | "archived" | "rejected"

type LinkedCompany = {
  id: string
  name: string
  slug: string | null
  status: string
  isOwner: boolean
  companyStatus: string
}

const COMPANY_STATUS_DOT: Record<string, string> = {
  added: "bg-[#ea580c]",
  draft: "bg-[#2563eb]",
  listed: "bg-[#7c3aed]",
  unlisted: "bg-[#a1a1a0]",
  invited: "bg-[#f59e0b]",
  prospected: "bg-[#f59e0b]",
  deactivated: "bg-[#dc2626]",
}

const CONTRIBUTOR_STATUS_CONFIG: Record<string, { label: string; dotColor: string }> = {
  invited: { label: "Invited", dotColor: "bg-amber-500" },
  unlisted: { label: "Unlisted", dotColor: "bg-muted-foreground" },
  listed: { label: "Listed", dotColor: "bg-emerald-500" },
  live_on_page: { label: "Featured", dotColor: "bg-teal-500" },
  rejected: { label: "Declined", dotColor: "bg-red-500" },
  removed: { label: "Removed", dotColor: "bg-red-500" },
}

export type AdminProjectRow = {
  id: string
  title: string
  slug: string | null
  status: ProjectStatus
  projectType: string | null
  imageCount: number
  isFeatured: boolean
  location: string | null
  createdAt: string | null
  owner: { name: string; avatarUrl: string | null } | null
  companies: LinkedCompany[]
  rejectionReason: string | null
}

const REJECTION_REASONS = [
  "Not a residential project",
  "Insufficient photos",
  "Low quality images",
  "Missing project details",
  "Duplicate project",
  "Inappropriate content",
  "Not architecture or interior design",
]

const STATUS_CONFIG: Record<ProjectStatus, { label: string; className: string; dotColor: string }> = {
  draft: { label: "In progress", className: "bg-amber-50 text-amber-800", dotColor: "bg-amber-500" },
  in_progress: { label: "In review", className: "bg-blue-50 text-blue-700", dotColor: "bg-blue-500" },
  published: { label: "Listed", className: "bg-[#016D75]/10 text-[#016D75]", dotColor: "bg-emerald-500" },
  completed: { label: "Completed", className: "bg-[#016D75]/10 text-[#016D75]", dotColor: "bg-[#016D75]" },
  archived: { label: "Unlisted", className: "bg-[#f5f5f4] text-[#6b6b68]", dotColor: "bg-muted-foreground" },
  rejected: { label: "Rejected", className: "bg-red-50 text-red-700", dotColor: "bg-red-500" },
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string; description: string }[] = [
  { value: "published", label: "Listed", description: "Live and visible to everyone" },
  { value: "archived", label: "Unlisted", description: "Hidden from public, preserved for records" },
  { value: "in_progress", label: "In review", description: "Submitted by client, awaiting admin approval" },
  { value: "draft", label: "In progress", description: "Not visible to the public" },
  { value: "rejected", label: "Rejected", description: "Declined by admin with feedback" },
]

interface AdminProjectsDataTableProps {
  projects: AdminProjectRow[]
  reviewCount?: number
  firstReviewProjectId?: string | null
}

export function AdminProjectsDataTable({ projects, reviewCount = 0, firstReviewProjectId }: AdminProjectsDataTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 })
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all")

  // Status dialog
  const [statusDialogProject, setStatusDialogProject] = useState<AdminProjectRow | null>(null)
  const [statusSelection, setStatusSelection] = useState<ProjectStatus>("draft")
  const [rejectionReason, setRejectionReason] = useState("")
  const [selectedRejectionReasons, setSelectedRejectionReasons] = useState<string[]>([])
  const [showRejectionOptions, setShowRejectionOptions] = useState(false)

  // Delete dialog
  const [deleteProject, setDeleteProject] = useState<AdminProjectRow | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [showStatusGuide, setShowStatusGuide] = useState(false)

  const handleStatusSubmit = () => {
    if (!statusDialogProject) return
    if (statusSelection === "rejected" && selectedRejectionReasons.length === 0 && !rejectionReason.trim()) {
      toast.error("Please select a rejection reason")
      return
    }

    startTransition(async () => {
      try {
        const combinedReason = statusSelection === "rejected"
          ? [...selectedRejectionReasons, ...(rejectionReason.trim() ? [rejectionReason.trim()] : [])].join(". ")
          : null

        // Enforce constraint: if owner company is Draft/Added, downgrade Listed to Unlisted
        let finalStatus = statusSelection
        if (finalStatus === "published") {
          const ownerCompany = statusDialogProject.companies.find(c => c.isOwner)
          const ownerStatus = ownerCompany?.companyStatus
          if (ownerStatus === "draft" || ownerStatus === "unclaimed") {
            finalStatus = "archived"
            toast.info("Owner company is not listed — project set to Unlisted instead")
          }
        }

        const result = await setProjectStatusAction({
          projectId: statusDialogProject.id,
          status: finalStatus,
          rejectionReason: combinedReason,
        })

        if (!result.success) {
          const error = "error" in result ? result.error : null
          toast.error("Status update failed", { description: typeof error === "object" && error ? error.message : "Unknown error" })
          return
        }

        toast.success("Status updated", {
          description: `${statusDialogProject.title} is now ${STATUS_CONFIG[finalStatus].label.toLowerCase()}.`,
        })
        setStatusDialogProject(null)
        setRejectionReason("")
        setSelectedRejectionReasons([])
        router.refresh()
      } catch {
        toast.error("Unexpected error while updating status.")
      }
    })
  }

  const handleDelete = () => {
    if (!deleteProject) return

    startTransition(async () => {
      try {
        const result = await deleteProjectAction({ projectId: deleteProject.id })

        if (!result.success) {
          const error = "error" in result ? result.error : null
          toast.error("Delete failed", { description: typeof error === "object" && error ? error.message : "Unknown error" })
          return
        }

        toast.success("Project deleted", { description: `${deleteProject.title} has been permanently removed.` })
        setDeleteProject(null)
        router.refresh()
      } catch {
        toast.error("Unexpected error while deleting project.")
      }
    })
  }

  const columns: ColumnDef<AdminProjectRow>[] = useMemo(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="h-3.5 w-3.5"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="h-3.5 w-3.5"
        />
      ),
      size: 32,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "project",
      header: "Project",
      accessorFn: (row) => row.title,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true
        const search = filterValue.toLowerCase()
        const { title, location, projectType, owner, companies } = row.original
        return (
          (title?.toLowerCase().includes(search) ?? false) ||
          (location?.toLowerCase().includes(search) ?? false) ||
          (projectType?.toLowerCase().includes(search) ?? false) ||
          (owner?.name?.toLowerCase().includes(search) ?? false) ||
          companies.some((c) => c.name.toLowerCase().includes(search))
        )
      },
      cell: ({ row }) => {
        const project = row.original
        const { title, slug, projectType, location, isFeatured } = project
        const descriptor = [projectType, location].filter(Boolean).join(" · ")
        return (
          <div className="flex items-start gap-2 min-w-0">
            <button
              type="button"
              className="shrink-0 mt-0.5 transition-colors"
              title={isFeatured ? "Remove from homepage" : "Feature on homepage"}
              onClick={async (e) => {
                e.stopPropagation()
                const result = await toggleProjectFeaturedAction({ projectId: project.id, isFeatured: !isFeatured })
                if (result.success) {
                  toast.success(isFeatured ? "Removed from homepage" : "Featured on homepage")
                  router.refresh()
                } else {
                  toast.error(result.error ?? "Failed to update")
                }
              }}
            >
              <Star
                size={14}
                className={isFeatured ? "fill-amber-400 text-amber-400" : "text-[#c4c4c2] hover:text-[#a1a1a0]"}
              />
            </button>
            <div className="flex flex-col gap-0.5 min-w-0">
              {slug ? (
                <a
                  href={`/projects/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="arco-table-primary hover:text-[#016D75] transition-colors truncate max-w-[240px]"
                >
                  {title}
                </a>
              ) : (
                <span className="arco-table-primary truncate max-w-[240px]">{title}</span>
              )}
              {descriptor && (
                <span className="arco-table-secondary truncate max-w-[240px]">{descriptor}</span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true
        return row.original.status === filterValue
      },
      cell: ({ row }) => {
        const project = row.original
        const config = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.draft
        return (
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              className="arco-table-status hover:opacity-70 transition-opacity cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                setStatusDialogProject(project)
                setStatusSelection(project.status)
              }}
            >
              <span className={`arco-table-status-dot ${config.dotColor}`} />
              {config.label}
            </button>
            {project.status === "rejected" && project.rejectionReason && (
              <span className="arco-table-secondary max-w-[180px] truncate" title={project.rejectionReason}>
                {project.rejectionReason}
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: "professionals",
      header: "Company",
      accessorFn: (row) => row.companies.length,
      sortingFn: (rowA, rowB) => rowA.original.companies.length - rowB.original.companies.length,
      cell: ({ row }) => {
        const { companies } = row.original

        if (companies.length === 0) {
          return <span className="arco-table-secondary">—</span>
        }

        const first = companies[0]
        const others = companies.slice(1)

        const renderBadges = (company: LinkedCompany) => {
          const config = CONTRIBUTOR_STATUS_CONFIG[company.status]
          return (
            <>
              {config && (
                <span className="status-pill">
                  <span className={`status-pill-dot ${config.dotColor}`} />
                  {config.label}
                </span>
              )}
              {company.isOwner && (
                <span className="status-pill">Owner</span>
              )}
            </>
          )
        }

        const projectId = row.original.id

        const renderCompanyDropdown = (company: LinkedCompany) => (
          <DropdownMenu key={company.id}>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex items-center gap-1.5 hover:text-[#016D75] transition-colors cursor-pointer text-left">
                <span className={`inline-block w-[6px] h-[6px] rounded-full shrink-0 ${COMPANY_STATUS_DOT[company.companyStatus] ?? "bg-muted-foreground"}`} />
                <span className="text-xs text-[#1c1c1a] truncate max-w-[150px]">{company.name}</span>
                {renderBadges(company)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px]">
              {company.slug && (
                <DropdownMenuItem asChild>
                  <a href={`/professionals/${company.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs cursor-pointer">
                    View company
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-xs cursor-pointer"
                onClick={async () => {
                  const result = await generateCompanyLoginLinkAction({ companyId: company.id })
                  if (result.success && result.loginUrl) {
                    await navigator.clipboard.writeText(result.loginUrl)
                    toast.success("Login link copied — paste in an incognito window")
                  } else {
                    toast.error(result.error ?? "Failed to generate login link")
                  }
                }}
              >
                Copy login link
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/dashboard/company?company_id=${company.id}`} target="_blank" rel="noopener noreferrer" className="text-xs cursor-pointer">
                  Edit company
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Project status</DropdownMenuLabel>
              {(["invited", "live_on_page", "listed", "unlisted", "rejected", "removed"] as const).map((status) => {
                const config = CONTRIBUTOR_STATUS_CONFIG[status]
                if (!config) return null
                const isCurrent = company.status === status
                return (
                  <DropdownMenuItem
                    key={status}
                    className={cn("text-xs cursor-pointer flex items-center gap-1.5", isCurrent && "font-semibold bg-[#f5f5f4]")}
                    onClick={async () => {
                      if (isCurrent) return
                      const result = await updateProjectProfessionalStatusAction({
                        projectId,
                        companyId: company.id,
                        status,
                      })
                      if (result.success) {
                        toast.success(`Status updated to ${config.label}`)
                        router.refresh()
                      } else {
                        toast.error(result.error ?? "Failed to update status")
                      }
                    }}
                  >
                    <span className={`inline-block w-[5px] h-[5px] rounded-full ${config.dotColor}`} />
                    {config.label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )

        return (
          <div className="flex flex-col gap-0.5">
            {renderCompanyDropdown(first)}
            {others.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="arco-table-secondary hover:text-[#016D75] transition-colors text-left cursor-pointer w-fit">
                    +{others.length} more
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[200px]">
                  {others.map((company) => (
                    <DropdownMenuSub key={company.id}>
                      <DropdownMenuSubTrigger className="flex items-center gap-1.5 text-xs">
                        <span className={`inline-block w-[6px] h-[6px] rounded-full shrink-0 ${COMPANY_STATUS_DOT[company.companyStatus] ?? "bg-muted-foreground"}`} />
                        <span className="truncate">{company.name}</span>
                        {renderBadges(company)}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="min-w-[180px]">
                        {company.slug && (
                          <DropdownMenuItem asChild>
                            <a href={`/professionals/${company.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs cursor-pointer">
                              View company
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                          <a href={`/dashboard/company?company_id=${company.id}`} target="_blank" rel="noopener noreferrer" className="text-xs cursor-pointer">
                            Log in as company
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a href={`/dashboard/company?company_id=${company.id}`} target="_blank" rel="noopener noreferrer" className="text-xs cursor-pointer">
                            Edit company
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Project status</DropdownMenuLabel>
                        {(["invited", "live_on_page", "listed", "unlisted", "rejected", "removed"] as const).map((status) => {
                          const config = CONTRIBUTOR_STATUS_CONFIG[status]
                          if (!config) return null
                          const isCurrent = company.status === status
                          return (
                            <DropdownMenuItem
                              key={status}
                              className={cn("text-xs cursor-pointer flex items-center gap-1.5", isCurrent && "font-semibold bg-[#f5f5f4]")}
                              onClick={async () => {
                                if (isCurrent) return
                                const result = await updateProjectProfessionalStatusAction({
                                  projectId,
                                  companyId: company.id,
                                  status,
                                })
                                if (result.success) {
                                  toast.success(`Status updated to ${config.label}`)
                                  router.refresh()
                                } else {
                                  toast.error(result.error ?? "Failed to update status")
                                }
                              }}
                            >
                              <span className={`inline-block w-[5px] h-[5px] rounded-full ${config.dotColor}`} />
                              {config.label}
                            </DropdownMenuItem>
                          )
                        })}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )
      },
    },
    {
      id: "linkedCount",
      header: "Professionals",
      accessorFn: (row) => row.companies.length,
      sortingFn: (rowA, rowB) => rowA.original.companies.length - rowB.original.companies.length,
      cell: ({ row }) => {
        const count = row.original.companies.length
        return count > 0
          ? <span className="arco-table-primary">{count}</span>
          : <span className="arco-table-secondary">—</span>
      },
    },
    {
      accessorKey: "imageCount",
      header: "Images",
      cell: ({ row }) => {
        const count = row.original.imageCount
        return count > 0
          ? <span className="arco-table-primary">{count}</span>
          : <span className="arco-table-secondary">—</span>
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.createdAt ? new Date(rowA.original.createdAt).getTime() : 0
        const b = rowB.original.createdAt ? new Date(rowB.original.createdAt).getTime() : 0
        return a - b
      },
      cell: ({ row }) => {
        const createdAt = row.original.createdAt
        if (!createdAt) return <span className="arco-table-secondary">—</span>
        try {
          return <span className="arco-table-nowrap">{format(new Date(createdAt), "PP")}</span>
        } catch {
          return <span className="arco-table-secondary">—</span>
        }
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const project = row.original
        const projectPath = project.slug ? `/projects/${project.slug}` : `/projects/${project.id}`
        const viewUrl = project.status === "published" ? projectPath : `${projectPath}?preview`

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="arco-table-action" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                  View project
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/edit/${project.id}`}>
                  Edit project
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setStatusSelection(project.status)
                  setRejectionReason("")
                  setStatusDialogProject(project)
                }}
              >
                Update status
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => { setDeleteProject(project); setDeleteConfirmText("") }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], [])

  const table = useReactTable({
    data: projects,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  })

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of projects) {
      counts[p.status] = (counts[p.status] ?? 0) + 1
    }
    return counts
  }, [projects])

  // Funnel buckets, mirroring the visual pattern of /admin/sales prospects.
  // Order: in progress → in review → rejected → listed → unlisted.
  // Rejected sits between In review and Listed because that's where the
  // off-path leak actually happens (admin rejects during review). The
  // conversion rate shown on the connector AFTER Rejected uses In review
  // as the denominator, not Rejected — so it represents "what fraction of
  // submitted projects actually got listed", bypassing the rejected leak.
  const FUNNEL_STATUSES: { status: ProjectStatus; driver: "draft" | "review" | "rejected" | "live" | "unlisted" }[] = [
    { status: "draft", driver: "draft" },
    { status: "in_progress", driver: "review" },
    { status: "rejected", driver: "rejected" },
    { status: "published", driver: "live" },
    { status: "archived", driver: "unlisted" },
  ]
  const DRIVER_COLORS_PROJECTS: Record<string, string> = {
    draft: "#f59e0b",
    review: "#2563eb",
    rejected: "#dc2626",
    live: "#7c3aed",
    unlisted: "#a1a1a0",
  }
  const DRIVER_LABEL_AT_PROJECTS: Record<string, ProjectStatus> = {
    draft: "draft",
    review: "in_progress",
    rejected: "rejected",
    live: "published",
    unlisted: "archived",
  }
  const conversionRate = (from: number, to: number): string => {
    if (from === 0) return "0%"
    return `${Math.round((to / from) * 100)}%`
  }

  return (
    <div className="flex flex-col gap-6 min-w-0 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h3 className="arco-section-title">Projects</h3>
        <p className="text-xs text-[#a1a1a0] mt-0.5">
          {projects.length} total
          {" · "}
          <button type="button" className="text-[#016D75] hover:underline cursor-pointer" onClick={() => setShowStatusGuide(true)}>
            Status guide
          </button>
        </p>
      </div>

      {/* Status funnel — same visual pattern as /admin/sales, plus a bypass
          line above the cards from In review → Listed showing the survival
          rate (submitted projects that actually reached Listed, ignoring the
          rejected leak). */}
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
        {(() => {
          const cols = FUNNEL_STATUSES.map((_, i) => i === 0 ? "auto" : "1fr auto").join(" ")
          const CARD_WIDTH = 132

          const countAt = (status: ProjectStatus) => statusCounts[status] ?? 0

          // Cohort that "reaches" each stage. Each cohort represents
          // everything currently in or past this stage on the linear flow.
          const cohortFor = (status: ProjectStatus): number => {
            switch (status) {
              case "draft":
                return countAt("draft") + countAt("in_progress") + countAt("rejected") + countAt("published") + countAt("archived")
              case "in_progress":
                return countAt("in_progress") + countAt("rejected") + countAt("published") + countAt("archived")
              case "rejected":
                return countAt("rejected")
              case "published":
                return countAt("published") + countAt("archived")
              case "archived":
                return countAt("archived")
              default:
                return 0
            }
          }

          // Bypass rate: In review → Listed, skipping the Rejected leak.
          const bypassRate = conversionRate(cohortFor("in_progress"), cohortFor("published"))

          return (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: cols,
                gridTemplateRows: "auto auto",
                gap: 0,
                alignItems: "start",
              }}
            >
              {/* Bypass arc — row 1, spans cols 3 through 7 (In review → Listed).
                  Inset by half a card width on each side so the line starts and
                  ends at the centers of the In review and Listed cards. */}
              <div
                style={{
                  gridRow: 1,
                  gridColumn: "3 / 8",
                  position: "relative",
                  height: 32,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: CARD_WIDTH / 2,
                    right: CARD_WIDTH / 2,
                    top: "50%",
                    borderTop: "1px solid #d4d4d3",
                  }}
                />
                {/* Drop-down ticks on each end so it visually anchors to the cards */}
                <div
                  style={{
                    position: "absolute",
                    left: CARD_WIDTH / 2,
                    top: "50%",
                    bottom: 0,
                    borderLeft: "1px solid #d4d4d3",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    right: CARD_WIDTH / 2,
                    top: "50%",
                    bottom: 0,
                    borderLeft: "1px solid #d4d4d3",
                  }}
                />
                {bypassRate && (
                  <span
                    className="absolute text-[10px] font-medium text-[#6b6b68]"
                    style={{
                      top: 0,
                      left: "50%",
                      transform: "translateX(-50%)",
                      whiteSpace: "nowrap",
                      background: "#fff",
                      padding: "0 6px",
                    }}
                  >
                    {bypassRate}
                  </span>
                )}
              </div>

              {/* Cards + inline connectors — row 2 */}
              {FUNNEL_STATUSES.map((stage, i) => {
                const count = statusCounts[stage.status] ?? 0
                const config = STATUS_CONFIG[stage.status]

                // Compute the rate label that sits on the connector BEFORE this card.
                // The "Rejected → Listed" connector is left blank because rejected
                // projects don't actually progress to listed — the bypass arc above
                // shows the meaningful In review → Listed rate.
                let rate = ""
                if (i > 0) {
                  const prev = FUNNEL_STATUSES[i - 1].status
                  if (prev !== "rejected") {
                    rate = conversionRate(cohortFor(prev), cohortFor(stage.status))
                  }
                }

                const isActive = statusFilter === stage.status
                return (
                  <Fragment key={stage.status}>
                    {i > 0 && (
                      <div
                        className="relative px-1 self-center"
                        style={{ gridRow: 2, minWidth: 32 }}
                      >
                        <div className="w-full border-t border-[#d4d4d3]" />
                        {rate && (
                          <span
                            className="absolute text-[10px] font-medium text-[#6b6b68]"
                            style={{ top: -16, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}
                          >
                            {rate}
                          </span>
                        )}
                      </div>
                    )}
                    <div style={{ gridRow: 2 }} className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => {
                          const next = isActive ? "all" : stage.status
                          setStatusFilter(next)
                          table.getColumn("status")?.setFilterValue(next === "all" ? undefined : next)
                        }}
                        className={`rounded-[3px] border bg-white px-3 py-3 transition-colors hover:border-[#c4c4c2] ${isActive ? "border-[#c4c4c2] bg-[#fafaf9]" : "border-[#e5e5e4]"}`}
                        style={{ width: CARD_WIDTH }}
                      >
                        <div className="flex items-center gap-[6px] mb-1.5">
                          <span className="status-pill-dot shrink-0" style={{ background: DRIVER_COLORS_PROJECTS[stage.driver] }} />
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 400, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{config.label}</span>
                        </div>
                        <p className="arco-card-title text-left">{count}</p>
                      </button>
                    </div>
                  </Fragment>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center">
          <input
            type="text"
            placeholder="Search by title, location, or professional…"
            className="w-full max-w-sm px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors placeholder:text-[#a1a1a0]"
            value={searchTerm}
            onChange={(event) => {
              const value = event.target.value
              setSearchTerm(value)
              table.getColumn("project")?.setFilterValue(value)
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {reviewCount > 0 && firstReviewProjectId && (
            <Link
              href={`/dashboard/edit/${firstReviewProjectId}?review=1`}
              className="btn-primary"
              style={{ fontSize: 13, padding: "6px 16px", borderRadius: 3 }}
            >
              Review ({reviewCount})
            </Link>
          )}
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              const next = value as typeof statusFilter
              setStatusFilter(next)
              table.getColumn("status")?.setFilterValue(next === "all" ? undefined : next)
            }}
          >
            <SelectTrigger className="w-[160px] h-9 text-xs border-[#e5e5e4] rounded-[3px]">
              <SelectValue placeholder="All statuses">
                {statusFilter === "all" ? "All statuses" : (
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_CONFIG[statusFilter].dotColor}`} />
                    {STATUS_CONFIG[statusFilter].label}
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(["published", "archived", "in_progress", "draft", "rejected"] as ProjectStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_CONFIG[s].dotColor}`} />
                    {STATUS_CONFIG[s].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk actions */}
      {Object.keys(rowSelection).length > 0 && (() => {
        const selectedCount = Object.keys(rowSelection).length
        return (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#f5f5f4] rounded-[3px] border border-[#e5e5e4]">
            <span className="text-xs text-[#6b6b68]">
              {selectedCount} selected
            </span>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="text-xs px-2.5 py-1 rounded-[3px] border border-[#e5e5e4] bg-white hover:bg-[#f5f5f4] transition-colors"
                    disabled={isBulkProcessing}
                  >
                    Change status
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[160px]">
                  {(["published", "in_progress", "archived", "draft", "rejected"] as const).map((status) => {
                    const config = STATUS_CONFIG[status]
                    return (
                      <DropdownMenuItem
                        key={status}
                        className="text-xs cursor-pointer flex items-center gap-1.5"
                        onClick={async () => {
                          const selectedRows = table.getSelectedRowModel().rows.map(r => r.original)
                          setIsBulkProcessing(true)
                          let success = 0
                          for (const project of selectedRows) {
                            if (project.status === status) continue
                            const result = await setProjectStatusAction({ projectId: project.id, status })
                            if (result.success) success++
                          }
                          if (success > 0) {
                            toast.success(`${success} project${success > 1 ? "s" : ""} updated to ${config.label}`)
                            setRowSelection({})
                            router.refresh()
                          }
                          setIsBulkProcessing(false)
                        }}
                      >
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.dotColor}`} />
                        {config.label}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                className="text-xs px-2.5 py-1 rounded-[3px] border border-[#e5e5e4] bg-white hover:bg-[#f5f5f4] transition-colors"
                disabled={isBulkProcessing}
                onClick={async () => {
                  const selectedRows = table.getSelectedRowModel().rows.map(r => r.original)
                  setIsBulkProcessing(true)
                  let success = 0
                  for (const project of selectedRows) {
                    if (project.isFeatured) continue
                    const result = await toggleProjectFeaturedAction({ projectId: project.id, isFeatured: true })
                    if (result.success) success++
                  }
                  if (success > 0) {
                    toast.success(`${success} project${success > 1 ? "s" : ""} featured on homepage`)
                    setRowSelection({})
                    router.refresh()
                  }
                  setIsBulkProcessing(false)
                }}
              >
                Feature
              </button>
              <button
                className="text-xs px-2.5 py-1 rounded-[3px] border border-[#e5e5e4] bg-white hover:bg-[#f5f5f4] transition-colors"
                disabled={isBulkProcessing}
                onClick={async () => {
                  const selectedRows = table.getSelectedRowModel().rows.map(r => r.original)
                  setIsBulkProcessing(true)
                  let success = 0
                  for (const project of selectedRows) {
                    if (!project.isFeatured) continue
                    const result = await toggleProjectFeaturedAction({ projectId: project.id, isFeatured: false })
                    if (result.success) success++
                  }
                  if (success > 0) {
                    toast.success(`${success} project${success > 1 ? "s" : ""} unfeatured`)
                    setRowSelection({})
                    router.refresh()
                  }
                  setIsBulkProcessing(false)
                }}
              >
                Unfeature
              </button>
              <button
                className="text-xs px-2.5 py-1 rounded-[3px] border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors"
                disabled={isBulkProcessing}
                onClick={() => setShowBulkDeleteConfirm(true)}
              >
                Delete
              </button>
            </div>
            {isBulkProcessing && <span className="text-xs text-[#a1a1a0]">Processing…</span>}
          </div>
        )
      })()}

      {/* Table */}
      <div className="arco-table-wrap">
        <table className="arco-table" style={{ minWidth: 800 }}>
          <thead>
            <tr>
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      style={header.id === "select" ? { width: 32, paddingRight: 0 } : undefined}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          className="arco-table-sort"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  )
                })
              )}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={cell.column.id === "select" ? { width: 32, paddingRight: 0 } : undefined}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>
                  No projects found. Adjust your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="arco-table-pagination">
        <span className="arco-table-pagination-count">
          {table.getFilteredRowModel().rows.length} {table.getFilteredRowModel().rows.length === 1 ? "result" : "results"}
        </span>
        <div className="arco-table-pagination-nav">
          <span className="arco-table-pagination-info">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <div className="flex items-center gap-1">
            <button
              className="arco-table-pagination-btn"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              ‹
            </button>
            <button
              className="arco-table-pagination-btn"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Status Update Dialog */}
      {statusDialogProject && (
        <div className="popup-overlay" onClick={() => { setStatusDialogProject(null); setRejectionReason(""); setSelectedRejectionReasons([]); setShowRejectionOptions(false) }}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Update status</h3>
              <button
                type="button"
                className="popup-close"
                onClick={() => { setStatusDialogProject(null); setRejectionReason(""); setSelectedRejectionReasons([]); setShowRejectionOptions(false) }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="status-modal-options">
              {(() => {
                const ownerCompany = statusDialogProject.companies.find(c => c.isOwner)
                const ownerStatus = ownerCompany?.companyStatus ?? null
                const canList = ownerStatus === "listed" || ownerStatus === "unlisted" || ownerStatus === "prospected"
                return STATUS_OPTIONS.map((option) => {
                const isSelected = statusSelection === option.value
                const hasRejectionReason = option.value === "rejected" && statusDialogProject.status === "rejected" && statusDialogProject.rejectionReason
                const isListBlocked = option.value === "published" && !canList
                const isDisabled = isListBlocked
                // For rejected with reason: show the reason as the description instead of default text
                const descText = isDisabled
                  ? `Owner company is ${ownerStatus ?? "unknown"} — must be Listed, Unlisted, or Prospected`
                  : hasRejectionReason ? statusDialogProject.rejectionReason! : option.description
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`status-modal-option${isSelected ? " selected" : ""}`}
                    disabled={isDisabled}
                    onClick={() => { setStatusSelection(option.value); setShowRejectionOptions(false) }}
                  >
                    <span className={`status-modal-dot ${STATUS_CONFIG[option.value].dotColor}`} />
                    <div className="status-modal-option-text">
                      <span className="status-modal-option-label">{option.label}</span>
                      <span className="status-modal-option-desc" style={isDisabled ? { color: "#92400e" } : undefined}>
                        {descText}
                        {hasRejectionReason && isSelected && !showRejectionOptions && (
                          <>
                            {" "}
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => { e.stopPropagation(); setShowRejectionOptions(true) }}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setShowRejectionOptions(true) } }}
                              style={{ fontWeight: 500, color: "#1c1c1a", textDecoration: "underline", cursor: "pointer" }}
                            >
                              Change
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  </button>
                )
              })
              })()}
            </div>

            {/* Rejection options — shown when selecting rejected for the first time, or after clicking "Change reason" */}
            {statusSelection === "rejected" && (showRejectionOptions || statusDialogProject.status !== "rejected" || !statusDialogProject.rejectionReason) && (
              <div style={{ padding: "0 24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {REJECTION_REASONS.map((reason) => {
                    const isSelected = selectedRejectionReasons.includes(reason)
                    return (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setSelectedRejectionReasons((prev) =>
                          isSelected ? prev.filter((r) => r !== reason) : [...prev, reason]
                        )}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 12px", borderRadius: 3, cursor: "pointer",
                          fontSize: 12, fontWeight: 400, textAlign: "left",
                          background: isSelected ? "var(--arco-surface)" : "#fff",
                          border: isSelected ? "1px solid #1c1c1a" : "1px solid #e5e5e4",
                          color: "#1c1c1a", transition: "border-color .15s, background .15s",
                        }}
                      >
                        <span style={{
                          width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                          border: isSelected ? "none" : "1.5px solid #d4d4d2",
                          background: isSelected ? "#1c1c1a" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {isSelected && (
                            <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                              <path d="M3 8l4 4 6-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        {reason}
                      </button>
                    )
                  })}

                  {/* Other — with free text */}
                  <div>
                    <button
                      type="button"
                      onClick={() => { if (rejectionReason) { setRejectionReason("") } else { setRejectionReason(" ") } }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%",
                        padding: "8px 12px", borderRadius: rejectionReason ? "3px 3px 0 0" : 3, cursor: "pointer",
                        fontSize: 12, fontWeight: 400, textAlign: "left",
                        background: rejectionReason ? "var(--arco-surface)" : "#fff",
                        border: rejectionReason ? "1px solid #1c1c1a" : "1px solid #e5e5e4",
                        borderBottom: rejectionReason ? "none" : undefined,
                        color: "#1c1c1a", transition: "border-color .15s, background .15s",
                      }}
                    >
                      <span style={{
                        width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                        border: rejectionReason ? "none" : "1.5px solid #d4d4d2",
                        background: rejectionReason ? "#1c1c1a" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {rejectionReason && (
                          <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                            <path d="M3 8l4 4 6-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      Other
                    </button>
                    {rejectionReason !== "" && (
                      <textarea
                        className="w-full px-3 py-2 text-sm outline-none transition-colors resize-none"
                        style={{ border: "1px solid #1c1c1a", borderTop: "none", borderRadius: "0 0 3px 3px", background: "var(--arco-surface)" }}
                        rows={2}
                        placeholder="Describe the reason…"
                        value={rejectionReason.trim() === "" ? "" : rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        autoFocus
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="popup-actions">
              <button
                type="button"
                className="btn-tertiary"
                onClick={() => { setStatusDialogProject(null); setRejectionReason(""); setSelectedRejectionReasons([]); setShowRejectionOptions(false) }}
                disabled={isPending}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleStatusSubmit}
                disabled={isPending}
                style={{ flex: 1 }}
              >
                {isPending ? "Updating…" : "Update status"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Guide Popup */}
      {showStatusGuide && (
        <div className="popup-overlay" onClick={() => setShowStatusGuide(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Project statuses</h3>
              <button type="button" className="popup-close" onClick={() => setShowStatusGuide(false)} aria-label="Close">✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { dot: "bg-emerald-500", label: "Listed", desc: "Published and visible to everyone on the platform.", specs: "Public · Searchable · Company must be Listed, Unlisted, or Prospected" },
                { dot: "bg-muted-foreground", label: "Unlisted", desc: "Hidden from public directories. Only accessible via direct link.", specs: "Hidden · Not searchable" },
                { dot: "bg-blue-500", label: "In review", desc: "Submitted by company, awaiting admin review before publishing.", specs: "Not visible · Pending approval" },
                { dot: "bg-amber-500", label: "In progress", desc: "Project is being set up. Not yet submitted for review.", specs: "Not visible · Draft state" },
                { dot: "bg-red-500", label: "Rejected", desc: "Declined by admin with feedback. Company can revise and resubmit.", specs: "Not visible · Feedback sent" },
              ].map((s) => (
                <div key={s.label} style={{ display: "flex", gap: 12 }}>
                  <span className={`${s.dot} shrink-0`} style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 5 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#1c1c1a" }}>{s.label}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b6b68", lineHeight: 1.4 }}>{s.desc}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#a1a1a0", lineHeight: 1.3 }}>{s.specs}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, padding: "12px 16px", background: "#f5f5f4", borderRadius: 4, fontSize: 11, color: "#6b6b68", lineHeight: 1.5 }}>
              <strong>Review flow:</strong> In progress → In review → Listed (or Rejected)
              <br />
              <strong>Constraints:</strong> Projects can only be Listed when the owning company is Listed, Unlisted, or Prospected. Projects owned by Added or Draft companies will be set to Unlisted after review.
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation — popup-card design */}
      {/* Bulk delete confirmation */}
      {showBulkDeleteConfirm && (() => {
        const selectedRows = table.getSelectedRowModel().rows.map(r => r.original)
        const count = selectedRows.length
        return (
          <div className="popup-overlay" onClick={() => { if (!isBulkProcessing) setShowBulkDeleteConfirm(false) }}>
            <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <div className="popup-header">
                <h3 className="arco-section-title">Delete {count} project{count > 1 ? "s" : ""}</h3>
                <button
                  type="button"
                  className="popup-close"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  aria-label="Close"
                  disabled={isBulkProcessing}
                >
                  ✕
                </button>
              </div>

              <div className="arco-alert arco-alert--warn">
                <AlertTriangle className="arco-alert-icon" />
                <div>
                  <p>This will permanently delete {count} project{count > 1 ? "s" : ""} and all associated data (photos, contributors, taxonomy). This action cannot be undone.</p>
                </div>
              </div>

              <div style={{ maxHeight: 160, overflowY: "auto", margin: "12px 0" }}>
                {selectedRows.map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5 py-1 text-xs text-[#6b6b68]">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_CONFIG[p.status]?.dotColor ?? "bg-[#a1a1a0]"}`} />
                    {p.title}
                  </div>
                ))}
              </div>

              <div className="popup-actions">
                <button
                  type="button"
                  className="btn-tertiary"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  disabled={isBulkProcessing}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isBulkProcessing}
                  onClick={async () => {
                    setIsBulkProcessing(true)
                    let success = 0
                    for (const project of selectedRows) {
                      const result = await deleteProjectAction({ projectId: project.id })
                      if (result.success) success++
                    }
                    if (success > 0) {
                      toast.success(`${success} project${success > 1 ? "s" : ""} deleted`)
                      setRowSelection({})
                      router.refresh()
                    }
                    setIsBulkProcessing(false)
                    setShowBulkDeleteConfirm(false)
                  }}
                  style={{ flex: 1, backgroundColor: "#dc2626", borderColor: "#dc2626", color: "#fff" }}
                >
                  {isBulkProcessing ? "Deleting…" : `Delete ${count} project${count > 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {deleteProject && (
        <div className="popup-overlay" onClick={() => { if (!isPending) { setDeleteProject(null); setDeleteConfirmText("") } }}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Delete project</h3>
              <button
                type="button"
                className="popup-close"
                onClick={() => { if (!isPending) { setDeleteProject(null); setDeleteConfirmText("") } }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="pb-3">
              <p className="text-sm font-medium text-[#1c1c1a] mb-0.5">{deleteProject.title}</p>

              <div className="arco-alert arco-alert--warn">
                <AlertTriangle className="arco-alert-icon" />
                <div>
                  <p>This will permanently delete &ldquo;{deleteProject.title}&rdquo; and all associated data (photos, contributors, taxonomy). This action cannot be undone.</p>
                </div>
              </div>

              <div className="pt-1">
                <label className="text-xs text-[#6b6b68] mb-1 block">
                  Type <span className="font-medium text-[#1c1c1a]">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors placeholder:text-[#a1a1a0]"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="popup-actions">
              <button
                type="button"
                className="btn-tertiary"
                onClick={() => { setDeleteProject(null); setDeleteConfirmText("") }}
                disabled={isPending}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleDelete}
                disabled={isPending || deleteConfirmText !== "DELETE"}
                style={{ flex: 1, backgroundColor: deleteConfirmText === "DELETE" ? "#dc2626" : undefined, borderColor: deleteConfirmText === "DELETE" ? "#dc2626" : undefined, color: deleteConfirmText === "DELETE" ? "#fff" : undefined }}
              >
                {isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
