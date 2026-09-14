"use client"

import { AdminTabs } from "@/components/admin/admin-tabs"

import { Fragment, useCallback, useMemo, useState, useTransition } from "react"
import { format, formatDistanceToNow } from "date-fns"
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
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  MoreHorizontal,
} from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"

import {
  changeAdminRoleAction,
  checkUserDeletionAction,
  deleteUserAction,
  generateAdminResetPasswordAction,
  generateLoginAsLinkAction,
  toggleAdminStatusAction,
} from "@/app/admin/users/actions"
import { generateCompanyLoginLinkAction } from "@/app/admin/companies/actions"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { ContactCard } from "@/components/contact-card/contact-card"
import { useContactParam } from "@/hooks/use-contact-param"

export type AdminUserCompany = {
  id: string
  name: string
  slug: string
  companyStatus: string
  projectCount: number
}

// Mirrors /admin/companies' STATUS_DOT exactly — one colour language
// for company status across admin (listed = retention purple).
const COMPANY_STATUS_DOT: Record<string, string> = {
  added: "bg-[#dc2626]",
  unclaimed: "bg-[#dc2626]",
  created: "bg-[#2563eb]",
  verified: "bg-[#2563eb]",
  owned: "bg-[#2563eb]",
  listed: "bg-[#7c3aed]",
  unlisted: "bg-[#a1a1a0]",
  deactivated: "bg-[#dc2626]",
  invited: "bg-[#f59e0b]",
  prospected: "bg-[#f59e0b]",
}

export type AdminUserRow = {
  id: string
  displayName: string
  email: string
  avatarUrl: string | null
  companies: AdminUserCompany[]
  role: "super_admin" | "admin" | "client"
  /** Funnel ladder (started → signup → saved) plus the two off-path
   *  account states (invited = pending admin invite, inactive = locked
   *  out). Derived server-side; not directly settable. */
  status: "started" | "signup" | "saved" | "invited" | "inactive"
  savedCount: number
  createdAt: string | null
  lastSignInAt: string | null
  invitedAt: string | null
  invitedByName: string | null
  invitedByEmail: string | null
  bannedUntil: string | null
  isLastSuperAdmin: boolean
  isSelf: boolean
}

type AdminUsersTableProps = {
  data: AdminUserRow[]
}

function getUserRoleLabel(user: AdminUserRow): string {
  if (user.role === "super_admin") return "Super Admin"
  if (user.role === "admin") return "Admin"
  if (user.companies.length > 0) return "Professional"
  return "Client"
}

const ROLE_LABELS: Record<AdminUserRow["role"], string> = {
  admin: "Admin",
  super_admin: "Super Admin",
  client: "Client",
}

const STATUS_DOT: Record<AdminUserRow["status"], string> = {
  started: "bg-amber-500",
  signup: "bg-blue-600",
  saved: "bg-violet-600",
  invited: "bg-amber-500",
  inactive: "bg-rose-500",
}

const STATUS_LABEL: Record<AdminUserRow["status"], string> = {
  started: "Signup Started",
  signup: "Signup",
  saved: "Saved",
  invited: "Invited",
  // "Deactivated", not "Inactive" — Inactive is an ACTIVITY level
  // (30–90 days quiet); this is the locked-out account state.
  inactive: "Deactivated",
}

/** Activity levels — recency of the last sign-in. Active = the MAU
 *  window. NB: last_sign_in_at is a proxy: it stamps sign-IN events,
 *  not visits on a long-lived session, so it undercounts real activity
 *  (PostHog stays the truth for MAU); levels here are deliberately
 *  coarse for that reason. */
type ActivityLevel = "active" | "inactive" | "dormant" | "never"

const activityFor = (lastSignInAt: string | null): ActivityLevel => {
  const date = parseDate(lastSignInAt)
  if (!date) return "never"
  const days = (Date.now() - date.getTime()) / 86_400_000
  if (days <= 30) return "active"
  if (days <= 90) return "inactive"
  return "dormant"
}

const ACTIVITY_DOT: Record<ActivityLevel, string> = {
  active: "bg-emerald-500",
  inactive: "bg-amber-500",
  dormant: "bg-rose-500",
  never: "bg-[#a1a1a0]",
}

const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  active: "Active",
  inactive: "Inactive",
  dormant: "Dormant",
  never: "Never",
}

/** Ladder order — used for sorting and the funnel cards. Hex colors
 *  mirror the company funnel's driver palette (amber = still converting,
 *  blue = acquired, purple = engaged/retention). */
const USER_FUNNEL: { status: "started" | "signup" | "saved"; dotColor: string }[] = [
  { status: "started", dotColor: "#f59e0b" },
  { status: "signup", dotColor: "#2563eb" },
  { status: "saved", dotColor: "#7c3aed" },
]

const ROLE_OPTIONS: { value: AdminUserRow["role"]; label: string; description: string; dotColor: string }[] = [
  { value: "client", label: "Client", description: "Standard user account, no admin access", dotColor: "bg-[#a1a1a0]" },
  { value: "admin", label: "Admin", description: "Manage listings and professionals", dotColor: "bg-blue-500" },
  { value: "super_admin", label: "Super Admin", description: "Full access including billing and settings", dotColor: "bg-[#016D75]" },
]

const USER_STATUS_OPTIONS: { value: "active" | "inactive"; label: string; description: string; dotColor: string }[] = [
  { value: "active", label: "Active", description: "User can log in and access the platform", dotColor: "bg-emerald-500" },
  { value: "inactive", label: "Deactivated", description: "User is blocked from logging in", dotColor: "bg-rose-500" },
]

/** Bar filter — multi-select DropdownMenu in the /admin/companies
 *  grammar: "Clear selection" header, checkbox items (menu stays open),
 *  optional status dot per option, trigger darkens while a selection is
 *  active and summarizes it ("2 statuses"). Radix Select is deliberately
 *  avoided here: its item-aligned popover centers the selected item over
 *  the trigger, so longer lists extend upward and slide under the site
 *  header. Empty selection = no filter. */
function BarMultiFilter<T extends string>({
  values,
  options,
  allLabel,
  countNoun,
  onChange,
}: {
  values: T[]
  options: readonly { value: T; label: string; dotClass?: string }[]
  allLabel: string
  /** Plural noun for the "N selected" trigger label, e.g. "statuses". */
  countNoun: string
  onChange: (values: T[]) => void
}) {
  const toggle = (value: T) =>
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value])
  const singleLabel = values.length === 1 ? options.find((o) => o.value === values[0])?.label : undefined
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`w-[140px] h-9 px-3 text-xs border rounded-[3px] transition-colors flex items-center justify-between gap-2 shrink-0 ${
            values.length > 0
              ? "border-[#1c1c1a] bg-[#fafaf9]"
              : "border-[#e5e5e4] bg-white hover:border-[#a1a1a0]"
          }`}
        >
          <span className="flex items-center gap-1.5 truncate">
            {values.length === 0 ? (
              <span className="text-[#6b6b68]">{allLabel}</span>
            ) : values.length === 1 ? (
              <span className="truncate">{singleLabel}</span>
            ) : (
              <span>{values.length} {countNoun}</span>
            )}
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[#a1a1a0]">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px] z-[120]">
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault()
            if (values.length > 0) onChange([])
          }}
          className="text-xs"
        >
          Clear selection
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={values.includes(option.value)}
            onCheckedChange={() => toggle(option.value)}
            onSelect={(e) => e.preventDefault()}
            className="text-xs"
          >
            {option.dotClass ? (
              <span className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${option.dotClass}`} />
                {option.label}
              </span>
            ) : (
              option.label
            )}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Admins sit OUTSIDE the signup funnel (the funnel cards count clients
 *  only), so their rows carry no funnel stage — showing one would make
 *  the Saved card say 3 while the Saved filter finds 4. Only the
 *  account states (Invited/Deactivated) still apply to admins. */
const displayStatus = (user: AdminUserRow): AdminUserRow["status"] | null => {
  if (user.role !== "client" && user.status !== "invited" && user.status !== "inactive") return null
  return user.status
}

const parseDate = (value: string | null) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatRelative = (value: string | null) => {
  const date = parseDate(value)
  if (!date) return null
  return formatDistanceToNow(date, { addSuffix: true })
}

export function UsersDataTable({ data }: AdminUsersTableProps) {
  const router = useRouter()
  // Contact Card slide-over — email-keyed URL param, same instance /admin/sales uses.
  const contactParam = useContactParam()
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  // "Load more" pagination — mirrors /admin/sales; grows by 50 per click.
  const LOAD_MORE_STEP = 50
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: LOAD_MORE_STEP,
  })

  const [roleDialogUser, setRoleDialogUser] = useState<AdminUserRow | null>(null)
  const [roleSelection, setRoleSelection] = useState<AdminUserRow["role"]>("client")

  const [statusDialogUser, setStatusDialogUser] = useState<AdminUserRow | null>(null)
  const [statusSelection, setStatusSelection] = useState<"active" | "inactive">("active")

  const [resettingUserId, setResettingUserId] = useState<string | null>(null)

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)

  const [searchTerm, setSearchTerm] = useState("")
  // Multi-select filters, /admin/companies-style: empty array = no filter.
  const [roleFilter, setRoleFilter] = useState<(AdminUserRow["role"] | "professional")[]>([])
  const [statusFilter, setStatusFilter] = useState<AdminUserRow["status"][]>([])
  const [activityFilter, setActivityFilter] = useState<ActivityLevel[]>([])

  const applyStatusFilter = (next: AdminUserRow["status"][]) => {
    setStatusFilter(next)
    table.getColumn("status")?.setFilterValue(next.length > 0 ? next : undefined)
  }

  const [isUpdatingRole, startRoleTransition] = useTransition()
  const [isUpdatingStatus, startStatusTransition] = useTransition()
  const [isGeneratingReset, startResetTransition] = useTransition()
  const [isDeletingUser, startDeleteTransition] = useTransition()
  const [loggingInAsUserId, setLoggingInAsUserId] = useState<string | null>(null)

  const [deleteUser, setDeleteUser] = useState<AdminUserRow | null>(null)
  const [deleteCheckResult, setDeleteCheckResult] = useState<{
    canDelete: boolean
    warnings: string[]
    blockers: string[]
    ownsCompany: boolean
    companyName?: string
  } | null>(null)
  const [isCheckingDelete, setIsCheckingDelete] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

  const handleResetPassword = useCallback(
    (user: AdminUserRow) => {
      setResettingUserId(user.id)
      startResetTransition(async () => {
        try {
          const result = await generateAdminResetPasswordAction({ userId: user.id })

          if (!result.success || !result.data?.resetUrl) {
            toast.error("Could not generate reset password link", {
              description: result.error ?? "Try again in a few moments.",
            })
            return
          }

          const url = result.data.resetUrl
          try {
            await navigator.clipboard.writeText(url)
            toast.success("Reset link copied", {
              description: `Share it with ${user.email} over a secure channel.`,
            })
          } catch {
            toast.success("Reset link ready", {
              description: url,
            })
          }
        } catch (err) {
          console.error(err)
          toast.error("Unexpected error while generating reset link.")
        } finally {
          setResettingUserId(null)
        }
      })
    },
    [startResetTransition],
  )

  const handleOpenDeleteDialog = useCallback(async (user: AdminUserRow) => {
    setDeleteUser(user)
    setDeleteCheckResult(null)
    setDeleteConfirmText("")
    setIsCheckingDelete(true)

    try {
      const result = await checkUserDeletionAction({ userId: user.id })

      if (!result.success || !result.data) {
        toast.error("Failed to check deletion requirements", {
          description: result.error,
        })
        setDeleteUser(null)
        setIsCheckingDelete(false)
        return
      }

      setDeleteCheckResult({
        canDelete: result.data.canDelete,
        warnings: result.data.warnings,
        blockers: result.data.blockers,
        ownsCompany: result.data.ownsCompany,
        companyName: result.data.companyName,
      })
      setIsCheckingDelete(false)
    } catch (err) {
      console.error(err)
      toast.error("Unexpected error while checking deletion requirements.")
      setDeleteUser(null)
      setIsCheckingDelete(false)
    }
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (!deleteUser) return

    startDeleteTransition(async () => {
      try {
        const result = await deleteUserAction({ userId: deleteUser.id })

        if (!result.success) {
          toast.error("Failed to delete user", {
            description: result.error,
          })
          return
        }

        toast.success("User deleted", {
          description: `${deleteUser.displayName} has been permanently deleted.`,
        })
        setDeleteUser(null)
        setDeleteCheckResult(null)
        router.refresh()
      } catch (err) {
        console.error(err)
        toast.error("Unexpected error while deleting user.")
      }
    })
  }, [deleteUser, router, startDeleteTransition])

  const handleLoginAs = useCallback(
    async (user: AdminUserRow) => {
      setLoggingInAsUserId(user.id)
      try {
        const result = await generateLoginAsLinkAction({ userId: user.id })
        if (!result.success || !result.data?.loginUrl) {
          toast.error("Could not generate login link", {
            description: result.error ?? "Try again in a few moments.",
          })
          return
        }
        await navigator.clipboard.writeText(result.data.loginUrl)
        toast.success("Login link copied", {
          description: `Paste in an incognito window to log in as ${user.email}`,
        })
      } catch (err) {
        console.error(err)
        toast.error("Unexpected error while generating login link.")
      } finally {
        setLoggingInAsUserId(null)
      }
    },
    [],
  )

  const handleConfirmRole = () => {
    if (!roleDialogUser) return
    if (roleSelection === roleDialogUser.role) {
      setRoleDialogUser(null)
      return
    }

    startRoleTransition(async () => {
      try {
        const result = await changeAdminRoleAction({
          userId: roleDialogUser.id,
          role: roleSelection === "client" ? "admin" : roleSelection,
        })

        if (!result.success) {
          toast.error("Role update failed", { description: result.error })
          return
        }

        toast.success("Role updated", {
          description: `${roleDialogUser.displayName} is now ${ROLE_LABELS[roleSelection] ?? roleSelection}.`,
        })
        setRoleDialogUser(null)
        router.refresh()
      } catch (err) {
        console.error(err)
        toast.error("Unexpected error while updating the role.")
      }
    })
  }

  const handleConfirmStatus = () => {
    if (!statusDialogUser) return
    const nextActive = statusSelection === "active"

    startStatusTransition(async () => {
      try {
        const result = await toggleAdminStatusAction({
          userId: statusDialogUser.id,
          active: nextActive,
        })

        if (!result.success) {
          toast.error("Status update failed", { description: result.error })
          return
        }

        toast.success(nextActive ? "User reactivated" : "User deactivated", {
          description: nextActive
            ? `${statusDialogUser.displayName} can log in again.`
            : `${statusDialogUser.displayName} can no longer access the platform.`,
        })
        setStatusDialogUser(null)
        router.refresh()
      } catch (err) {
        console.error(err)
        toast.error("Unexpected error while updating status.")
      }
    })
  }

  const columns = useMemo<ColumnDef<AdminUserRow>[]>(() => {
    return [
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
        accessorKey: "displayName",
        header: "Name",
        cell: ({ row }) => {
          const initials = row.original.displayName
            .split(" ")
            .filter(Boolean)
            .map((token) => token[0]?.toUpperCase())
            .slice(0, 2)
            .join("") || row.original.email.charAt(0).toUpperCase()

          return (
            <div className="flex items-center gap-3">
              {row.original.avatarUrl ? (
                <div className="arco-table-avatar">
                  <img src={row.original.avatarUrl} alt={row.original.displayName} referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className="arco-table-avatar" style={{ background: "#f5f5f4", color: "#6b6b68" }}>
                  {initials}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="arco-table-primary">{row.original.displayName}</span>
                <span className="arco-table-secondary">{row.original.email}</span>
              </div>
            </div>
          )
        },
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue) return true
          const search = (filterValue as string).toLowerCase()
          const companyNames = row.original.companies.map((c) => c.name).join(" ")
          const value = `${row.getValue(columnId)} ${row.original.email} ${companyNames}`.toLowerCase()
          return value.includes(search)
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 160,
        sortingFn: (rowA, rowB) => {
          const order = { started: 0, signup: 1, saved: 2, invited: 3, inactive: 4 }
          const statusA = displayStatus(rowA.original)
          const statusB = displayStatus(rowB.original)
          const statusDiff = (statusA ? order[statusA] : 5) - (statusB ? order[statusB] : 5)
          if (statusDiff !== 0) return statusDiff
          const a = rowA.original.lastSignInAt ? new Date(rowA.original.lastSignInAt).getTime() : 0
          const b = rowB.original.lastSignInAt ? new Date(rowB.original.lastSignInAt).getTime() : 0
          return b - a
        },
        cell: ({ row }) => {
          const status = displayStatus(row.original)
          if (!status) return <span className="text-xs text-[#a1a1a0]">—</span>
          return (
            <div className="flex items-center gap-1.5">
              <span className={cn("arco-table-status-dot", STATUS_DOT[status])} />
              <span className="text-xs text-[#1c1c1a]">{STATUS_LABEL[status]}</span>
              {status === "saved" && (
                <span className="text-[11px] text-[#a1a1a0]">· {row.original.savedCount}</span>
              )}
            </div>
          )
        },
        filterFn: (row, columnId, filterValue) => {
          const values = filterValue as string[] | undefined
          if (!values || values.length === 0) return true
          const status = displayStatus(row.original)
          return status ? values.includes(status) : false
        },
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => {
          const roleLabel = getUserRoleLabel(row.original)
          return (
            <span className={cn(
              "text-xs font-medium",
              row.original.role === "super_admin" ? "text-[#016D75]" : "text-[#6b6b68]"
            )}>
              {roleLabel}
            </span>
          )
        },
        // Matches the DERIVED role the cell displays: a client with a
        // company reads (and filters) as Professional, not Client.
        filterFn: (row, columnId, filterValue) => {
          const values = filterValue as string[] | undefined
          if (!values || values.length === 0) return true
          const user = row.original
          const derived =
            user.role === "client" ? (user.companies.length > 0 ? "professional" : "client") : user.role
          return values.includes(derived)
        },
      },
      {
        id: "companies",
        header: "Company",
        cell: ({ row }) => {
          const companies = row.original.companies
          if (!companies.length) {
            return <span className="text-xs text-[#a1a1a0]">—</span>
          }
          const first = companies[0]
          const overflow = companies.length - 1

          const renderCompanyMenu = (company: AdminUserCompany) => (
            <DropdownMenu key={company.id}>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center gap-1.5 hover:text-[#016D75] transition-colors cursor-pointer text-left">
                  <span className={`arco-table-status-dot ${COMPANY_STATUS_DOT[company.companyStatus] ?? "bg-muted-foreground"}`} />
                  <span className="text-xs text-[#1c1c1a] truncate max-w-[150px]">{company.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[180px]">
                <DropdownMenuItem asChild>
                  <a href={`/professionals/${company.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs cursor-pointer">
                    View company
                  </a>
                </DropdownMenuItem>
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
              </DropdownMenuContent>
            </DropdownMenu>
          )

          return (
            <div className="flex flex-col gap-0.5">
              {renderCompanyMenu(first)}
              {overflow > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="text-[11px] text-[#a1a1a0] hover:text-[#016D75] transition-colors text-left cursor-pointer w-fit"
                    >
                      +{overflow} more
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[200px]">
                    {companies.slice(1).map((company) => (
                      <DropdownMenuItem key={company.id} asChild>
                        <button type="button" className="flex items-center gap-1.5 text-xs cursor-pointer w-full text-left" onClick={() => {}}>
                          <span className={`arco-table-status-dot ${COMPANY_STATUS_DOT[company.companyStatus] ?? "bg-muted-foreground"}`} />
                          <span className="truncate">{company.name}</span>
                        </button>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )
        },
      },
      {
        id: "activity",
        header: "Activity",
        size: 140,
        accessorFn: (row) => activityFor(row.lastSignInAt),
        sortingFn: (rowA, rowB) => {
          const order: Record<ActivityLevel, number> = { active: 0, inactive: 1, dormant: 2, never: 3 }
          const diff = order[activityFor(rowA.original.lastSignInAt)] - order[activityFor(rowB.original.lastSignInAt)]
          if (diff !== 0) return diff
          const a = rowA.original.lastSignInAt ? new Date(rowA.original.lastSignInAt).getTime() : 0
          const b = rowB.original.lastSignInAt ? new Date(rowB.original.lastSignInAt).getTime() : 0
          return b - a
        },
        cell: ({ row }) => {
          const level = activityFor(row.original.lastSignInAt)
          const lastActive = formatRelative(row.original.lastSignInAt)
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className={cn("arco-table-status-dot", ACTIVITY_DOT[level])} />
                <span className="text-xs text-[#1c1c1a]">{ACTIVITY_LABEL[level]}</span>
              </div>
              <span className="text-[11px] text-[#a1a1a0] pl-3">
                {lastActive ? `Last active ${lastActive}` : "No sign-ins yet"}
              </span>
            </div>
          )
        },
        filterFn: (row, columnId, filterValue) => {
          const values = filterValue as string[] | undefined
          if (!values || values.length === 0) return true
          return values.includes(row.getValue(columnId))
        },
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        size: 120,
        cell: ({ row }) => {
          const date = parseDate(row.original.createdAt)
          if (!date) return <span className="text-xs text-[#a1a1a0]">—</span>
          return <span className="text-xs text-[#6b6b68]">{format(date, "PP")}</span>
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const user = row.original
          const isInactive = user.status === "inactive"
          const disableStatusChange = (!isInactive && user.isLastSuperAdmin) || user.isSelf
          const isLoggingIn = loggingInAsUserId === user.id

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="arco-table-action" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => contactParam.open(user.email)}>
                  Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={user.isSelf || user.status === "invited" || isLoggingIn}
                  onClick={() => handleLoginAs(user)}
                >
                  {isLoggingIn ? "Generating link…" : "Log in as user"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setRoleDialogUser(user)
                    setRoleSelection(user.role)
                  }}
                >
                  Update role
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={disableStatusChange}
                  onClick={() => {
                    setStatusDialogUser(user)
                    setStatusSelection("active")
                  }}
                >
                  Update status
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={user.status === "invited" || (isGeneratingReset && resettingUserId === user.id)}
                  onClick={() => handleResetPassword(user)}
                >
                  {isGeneratingReset && resettingUserId === user.id ? "Generating…" : "Reset password link"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={user.isSelf}
                  onClick={() => handleOpenDeleteDialog(user)}
                  className="text-red-600 focus:text-red-600"
                >
                  Delete user
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
        enableSorting: false,
        enableHiding: false,
      },
    ]
  }, [handleResetPassword, handleOpenDeleteDialog, handleLoginAs, isGeneratingReset, resettingUserId, loggingInAsUserId, contactParam])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
      rowSelection,
    },
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
  })

  // Counter follows the filtered result set (search + filters), like the
  // companies table; unfiltered it equals the full population.
  const visibleRows = table.getFilteredRowModel().rows
  const visibleUsers = visibleRows.length
  const visibleSuperAdmins = visibleRows.filter((row) => row.original.role === "super_admin").length

  return (
    // Fragment — mirrors ProspectsClient on /admin/sales. Any wrapper
    // div here (flex-col, space-y, whatever) was collapsing to a
    // narrow column on mobile hard-reload. Making the sections
    // direct children of .wrap sidesteps every flex-child sizing
    // path; block-flow with mb-* on each section gives the same
    // visual spacing.
    <>
      {/* Sticky workbench bar — title, search, filters. */}
      <AdminTabs
        title="Users"
        actions={
          <>
          <div className="relative shrink-0" style={{ width: 240 }}>
          <input
            type="text"
            placeholder="Search by name or email…"
            className="w-full h-9 pl-8 pr-3 text-xs border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors placeholder:text-[#a1a1a0]"
            value={searchTerm}
            onChange={(event) => {
              const value = event.target.value
              setSearchTerm(value)
              table.getColumn("displayName")?.setFilterValue(value)
            }}
          />
            <svg className="absolute left-2.5 top-2.5 text-[#a1a1a0]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <BarMultiFilter
            values={roleFilter}
            allLabel="All roles"
            countNoun="roles"
            options={[
              { value: "super_admin", label: "Super admins" },
              { value: "admin", label: "Admins" },
              { value: "professional", label: "Professionals" },
              { value: "client", label: "Clients" },
            ] as const}
            onChange={(next) => {
              setRoleFilter(next)
              table.getColumn("role")?.setFilterValue(next.length > 0 ? next : undefined)
            }}
          />
          {/* Ladder in reverse order (furthest first), terminal states at
              the bottom — matches the /admin/companies status dropdown. */}
          <BarMultiFilter
            values={statusFilter}
            allLabel="All statuses"
            countNoun="statuses"
            options={[
              // No "Invited" here: nothing calls inviteAdminUserAction
              // anymore and every live signup path auto-confirms, so the
              // state is unreachable. The column still renders it
              // defensively should a row ever carry it.
              { value: "saved", label: "Saved", dotClass: STATUS_DOT.saved },
              { value: "signup", label: "Signup", dotClass: STATUS_DOT.signup },
              { value: "started", label: "Signup Started", dotClass: STATUS_DOT.started },
              { value: "inactive", label: "Deactivated", dotClass: STATUS_DOT.inactive },
            ] as const}
            onChange={applyStatusFilter}
          />
          <BarMultiFilter
            values={activityFilter}
            allLabel="All activity"
            countNoun="levels"
            options={[
              { value: "active", label: "Active", dotClass: ACTIVITY_DOT.active },
              { value: "inactive", label: "Inactive", dotClass: ACTIVITY_DOT.inactive },
              { value: "dormant", label: "Dormant", dotClass: ACTIVITY_DOT.dormant },
              { value: "never", label: "Never", dotClass: ACTIVITY_DOT.never },
            ] as const}
            onChange={(next) => {
              setActivityFilter(next)
              table.getColumn("activity")?.setFilterValue(next.length > 0 ? next : undefined)
            }}
          />
          </>
        }
      />

      <div className="wrap" style={{ paddingTop: 32, paddingBottom: 48 }}>

      {/* User funnel — Started → Signup → Saved, in the /admin/companies
          card grammar. Clients only: admins never enter the signup
          funnel. Narrowed by search but NOT by the status filter — the
          cards themselves are the status filter (counting only the
          active stage would zero the other cards). Connector rates are
          cohort-based: everyone at-or-past the stage; Invited and
          Inactive are off-path and don't accumulate. */}
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0" style={{ marginBottom: 28 }}>
        {(() => {
          const CARD_WIDTH = 132
          const funnelData = data.filter((r) => {
            if (r.role !== "client") return false
            if (!searchTerm) return true
            const lowered = searchTerm.toLowerCase()
            const haystack = `${r.displayName} ${r.email} ${r.companies.map((c) => c.name).join(" ")}`.toLowerCase()
            return haystack.includes(lowered)
          })
          const countAt = (s: AdminUserRow["status"]) => funnelData.filter((r) => r.status === s).length
          const cohortFor = (s: "started" | "signup" | "saved"): number => {
            switch (s) {
              case "started":
                return countAt("started") + countAt("signup") + countAt("saved")
              case "signup":
                return countAt("signup") + countAt("saved")
              case "saved":
                return countAt("saved")
            }
          }
          const rateFor = (from: "started" | "signup" | "saved", to: "started" | "signup" | "saved"): string => {
            const denom = cohortFor(from)
            if (denom === 0) return "0%"
            return `${Math.round((cohortFor(to) / denom) * 100)}%`
          }
          const toggleFunnelStatus = (status: "started" | "signup" | "saved") => {
            applyStatusFilter(
              statusFilter.includes(status)
                ? statusFilter.filter((s) => s !== status)
                : [...statusFilter, status],
            )
          }
          return (
            <div style={{ display: "grid", gridTemplateColumns: "auto 64px auto 64px auto", alignItems: "start", width: "fit-content" }}>
              {USER_FUNNEL.map((stage, i) => {
                const isActive = statusFilter.includes(stage.status)
                return (
                  <Fragment key={stage.status}>
                    {i > 0 && (
                      <div className="relative px-1 self-center" style={{ minWidth: 32 }}>
                        <div className="w-full border-t border-[#d4d4d3]" />
                        <span
                          className="absolute text-[10px] font-medium text-[#6b6b68]"
                          style={{ top: -16, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}
                        >
                          {rateFor(USER_FUNNEL[i - 1].status, stage.status)}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => toggleFunnelStatus(stage.status)}
                        className={`rounded-[3px] border bg-white px-3 py-3 transition-colors hover:border-[#c4c4c2] ${isActive ? "border-[#1c1c1a] bg-[#fafaf9]" : "border-[#e5e5e4]"}`}
                        style={{ width: CARD_WIDTH }}
                      >
                        <div className="flex items-center gap-[6px] mb-1.5">
                          <span className="status-pill-dot shrink-0" style={{ background: stage.dotColor }} />
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 400, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                            {STATUS_LABEL[stage.status]}
                          </span>
                        </div>
                        <p className="arco-card-title text-left">{countAt(stage.status)}</p>
                      </button>
                    </div>
                  </Fragment>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Page meta — count in the discover style, margins as on Projects */}
      <div className="discover-results-meta" style={{ marginBottom: 0 }}>
        <p className="discover-results-count">
          <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{visibleUsers}</strong> user{visibleUsers === 1 ? "" : "s"}
          {visibleSuperAdmins > 0 && <> &middot; {visibleSuperAdmins} super admin{visibleSuperAdmins === 1 ? "" : "s"}</>}
        </p>
      </div>

      {/* Bulk actions */}
      {Object.keys(rowSelection).length > 0 && (() => {
        const selectedCount = Object.keys(rowSelection).length
        return (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#f5f5f4] rounded-[3px] border border-[#e5e5e4] mb-6">
            <span className="text-xs text-[#6b6b68]">{selectedCount} selected</span>
            <div className="flex items-center gap-2">
              <button
                className="text-xs px-2.5 py-1 rounded-[3px] border border-[#e5e5e4] bg-white hover:bg-[#f5f5f4] transition-colors"
                disabled={isBulkProcessing}
                onClick={async () => {
                  const selectedRows = table.getSelectedRowModel().rows.map(r => r.original)
                  setIsBulkProcessing(true)
                  let success = 0
                  for (const user of selectedRows) {
                    if (user.status !== "inactive") continue
                    const result = await toggleAdminStatusAction({ userId: user.id, active: true })
                    if (result.success) success++
                  }
                  if (success > 0) {
                    toast.success(`${success} user${success > 1 ? "s" : ""} activated`)
                    setRowSelection({})
                    router.refresh()
                  }
                  setIsBulkProcessing(false)
                }}
              >
                Activate
              </button>
              <button
                className="text-xs px-2.5 py-1 rounded-[3px] border border-[#e5e5e4] bg-white hover:bg-[#f5f5f4] transition-colors"
                disabled={isBulkProcessing}
                onClick={async () => {
                  const selectedRows = table.getSelectedRowModel().rows.map(r => r.original)
                  setIsBulkProcessing(true)
                  let success = 0
                  for (const user of selectedRows) {
                    if (user.status === "inactive") continue
                    const result = await toggleAdminStatusAction({ userId: user.id, active: false })
                    if (result.success) success++
                  }
                  if (success > 0) {
                    toast.success(`${success} user${success > 1 ? "s" : ""} deactivated`)
                    setRowSelection({})
                    router.refresh()
                  }
                  setIsBulkProcessing(false)
                }}
              >
                Deactivate
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
      <div className="arco-table-wrap" style={{ marginTop: 16 }}>
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
                      style={header.id === "select" ? { width: 32, paddingRight: 0 } : header.column.columnDef.size ? { minWidth: header.column.columnDef.size } : undefined}
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
                <tr
                  key={row.id}
                  onClick={() => contactParam.open(row.original.email)}
                  style={{ cursor: "pointer" }}
                  className="hover:bg-[#fafaf9]"
                >
                  {row.getVisibleCells().map((cell) => {
                    // Interactive cells stop the row-level click so the
                    // checkbox and kebab don't also open the panel.
                    const interactive = cell.column.id === "select" || cell.column.id === "actions" || cell.column.id === "companies"
                    return (
                      <td
                        key={cell.id}
                        onClick={interactive ? (e) => e.stopPropagation() : undefined}
                        style={cell.column.id === "select" ? { width: 32, paddingRight: 0 } : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>
                  No users found. Adjust your filters or invite a new teammate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Load more — replaces Previous/Next. Hidden when we've already
          rendered every filtered row. */}
      {(() => {
        const total = table.getFilteredRowModel().rows.length
        const visible = Math.min(pagination.pageSize, total)
        const canLoadMore = visible < total
        return (
          <div className="arco-table-pagination">
            <span className="arco-table-pagination-count">
              {visible} of {total} user{total === 1 ? "" : "s"}
            </span>
            {canLoadMore && (
              <div className="flex justify-center mt-3 w-full">
                <button
                  className="h-9 px-6 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors"
                  onClick={() => setPagination((p) => ({ ...p, pageIndex: 0, pageSize: p.pageSize + LOAD_MORE_STEP }))}
                >
                  Load more
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {/* Role Dialog — popup-card design */}
      {roleDialogUser && (
        <div className="popup-overlay" onClick={() => setRoleDialogUser(null)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Update role</h3>
              <button type="button" className="popup-close" onClick={() => setRoleDialogUser(null)} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="status-modal-options">
              {ROLE_OPTIONS.map((option) => {
                const isSelected = roleSelection === option.value
                const isLastSuperAdmin = roleDialogUser.isLastSuperAdmin && roleDialogUser.role === "super_admin" && option.value !== "super_admin"
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`status-modal-option${isSelected ? " selected" : ""}`}
                    disabled={isLastSuperAdmin}
                    onClick={() => setRoleSelection(option.value)}
                  >
                    <span className={`status-modal-dot ${option.dotColor}`} />
                    <div className="status-modal-option-text">
                      <span className="status-modal-option-label">{option.label}</span>
                      <span className="status-modal-option-desc">{option.description}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {roleDialogUser.isLastSuperAdmin && roleDialogUser.role === "super_admin" && (
              <div className="pb-2">
                <p className="border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs text-amber-900 rounded-[3px]">
                  Promote another super admin before demoting this user.
                </p>
              </div>
            )}

            <div className="popup-actions">
              <button type="button" className="btn-tertiary" onClick={() => setRoleDialogUser(null)} disabled={isUpdatingRole} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleConfirmRole}
                disabled={isUpdatingRole || roleSelection === roleDialogUser.role}
                style={{ flex: 1 }}
              >
                {isUpdatingRole ? "Updating…" : "Update role"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Dialog — popup-card design */}
      {statusDialogUser && (
        <div className="popup-overlay" onClick={() => setStatusDialogUser(null)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Update status</h3>
              <button type="button" className="popup-close" onClick={() => setStatusDialogUser(null)} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="status-modal-options">
              {USER_STATUS_OPTIONS.map((option) => {
                const isSelected = statusSelection === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`status-modal-option${isSelected ? " selected" : ""}`}
                    onClick={() => setStatusSelection(option.value)}
                  >
                    <span className={`status-modal-dot ${option.dotColor}`} />
                    <div className="status-modal-option-text">
                      <span className="status-modal-option-label">{option.label}</span>
                      <span className="status-modal-option-desc">{option.description}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {statusDialogUser.isLastSuperAdmin && statusSelection === "inactive" && (
              <div className="pb-2">
                <p className="border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs text-amber-900 rounded-[3px]">
                  This is the last active super admin. Promote another before deactivating.
                </p>
              </div>
            )}

            <div className="popup-actions">
              <button type="button" className="btn-tertiary" onClick={() => setStatusDialogUser(null)} disabled={isUpdatingStatus} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleConfirmStatus}
                disabled={
                  isUpdatingStatus ||
                  (statusSelection === "active" && statusDialogUser.status !== "inactive") ||
                  (statusSelection === "inactive" && statusDialogUser.status === "inactive") ||
                  (statusSelection === "inactive" && statusDialogUser.isLastSuperAdmin)
                }
                style={{ flex: 1 }}
              >
                {isUpdatingStatus ? "Updating…" : "Update status"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation — popup-card design */}
      {deleteUser && (
        <div className="popup-overlay" onClick={() => { if (!isDeletingUser) { setDeleteUser(null); setDeleteCheckResult(null) } }}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Delete user</h3>
              <button
                type="button"
                className="popup-close"
                onClick={() => { if (!isDeletingUser) { setDeleteUser(null); setDeleteCheckResult(null) } }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="pb-3">
              <div className="flex items-center gap-3 mb-3">
                {deleteUser.avatarUrl ? (
                  <img
                    src={deleteUser.avatarUrl}
                    alt={deleteUser.displayName}
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5f5f4] text-xs font-medium text-[#6b6b68]">
                    {deleteUser.displayName
                      .split(" ")
                      .filter(Boolean)
                      .map((token) => token[0]?.toUpperCase())
                      .slice(0, 2)
                      .join("") || deleteUser.email.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-[#1c1c1a] truncate">{deleteUser.displayName}</span>
                  <span className="text-xs text-[#a1a1a0] truncate">{deleteUser.email}</span>
                </div>
              </div>

              <div className="arco-alert arco-alert--warn">
                <AlertTriangle className="arco-alert-icon" />
                <div>
                  <p>This action cannot be undone. All data associated with this user will be permanently deleted.</p>
                </div>
              </div>
            </div>

            {isCheckingDelete ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-[#a1a1a0]" />
                <span className="ml-2 text-xs text-[#a1a1a0]">Checking deletion requirements…</span>
              </div>
            ) : deleteCheckResult ? (
              <div className="pb-2 space-y-2">
                {deleteCheckResult.blockers.length > 0 && (
                  <div className="arco-alert arco-alert--danger">
                    <AlertTriangle className="arco-alert-icon" />
                    <div>
                      <p style={{ fontWeight: 500 }}>Cannot delete user</p>
                      {deleteCheckResult.blockers.map((blocker, idx) => (
                        <p key={idx}>{blocker}</p>
                      ))}
                    </div>
                  </div>
                )}

                {deleteCheckResult.canDelete && deleteCheckResult.warnings.length > 0 && (
                  <div className="arco-alert arco-alert--warn">
                    <AlertTriangle className="arco-alert-icon" />
                    <div>
                      <p style={{ fontWeight: 500 }}>The following data will be deleted:</p>
                      {deleteCheckResult.warnings.map((warning, idx) => (
                        <p key={idx}>{warning}</p>
                      ))}
                    </div>
                  </div>
                )}

                {deleteCheckResult.canDelete && deleteCheckResult.warnings.length === 0 && (
                  <div className="arco-alert arco-alert--info">
                    <AlertTriangle className="arco-alert-icon" />
                    <div>
                      <p>This user has no related data. The account will be permanently deleted.</p>
                    </div>
                  </div>
                )}

                {deleteCheckResult.canDelete && (
                  <div className="pt-1">
                    <label className="text-xs text-[#6b6b68] mb-1 block">
                      Type <span className="font-medium text-[#1c1c1a]">DELETE</span> to confirm
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="w-full h-9 px-3 text-xs border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors placeholder:text-[#a1a1a0]"
                      autoComplete="off"
                    />
                  </div>
                )}
              </div>
            ) : null}

            <div className="popup-actions">
              <button
                type="button"
                className="btn-tertiary"
                onClick={() => { setDeleteUser(null); setDeleteCheckResult(null) }}
                disabled={isDeletingUser || isCheckingDelete}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleConfirmDelete}
                disabled={isDeletingUser || isCheckingDelete || !deleteCheckResult?.canDelete || deleteConfirmText !== "DELETE"}
                style={{ flex: 1, backgroundColor: deleteCheckResult?.canDelete && deleteConfirmText === "DELETE" ? "#dc2626" : undefined, borderColor: deleteCheckResult?.canDelete && deleteConfirmText === "DELETE" ? "#dc2626" : undefined, color: deleteCheckResult?.canDelete && deleteConfirmText === "DELETE" ? "#fff" : undefined }}
              >
                {isDeletingUser ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation */}
      {showBulkDeleteConfirm && (() => {
        const selectedRows = table.getSelectedRowModel().rows.map(r => r.original)
        const count = selectedRows.length
        return (
          <div className="popup-overlay" onClick={() => { if (!isBulkProcessing) setShowBulkDeleteConfirm(false) }}>
            <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <div className="popup-header">
                <h3 className="arco-section-title">Delete {count} user{count > 1 ? "s" : ""}</h3>
                <button type="button" className="popup-close" onClick={() => setShowBulkDeleteConfirm(false)} aria-label="Close" disabled={isBulkProcessing}>✕</button>
              </div>
              <div className="arco-alert arco-alert--warn">
                <AlertTriangle className="arco-alert-icon" />
                <div><p>This will permanently delete {count} user{count > 1 ? "s" : ""} and all associated data. This action cannot be undone.</p></div>
              </div>
              <div style={{ maxHeight: 160, overflowY: "auto", margin: "12px 0" }}>
                {selectedRows.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 py-1 text-xs text-[#6b6b68]">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[u.status] ?? "bg-[#a1a1a0]"}`} />
                    <span>{u.displayName}</span>
                    <span className="text-[#a1a1a0]">{u.email}</span>
                  </div>
                ))}
              </div>
              <div className="popup-actions">
                <button type="button" className="btn-tertiary" onClick={() => setShowBulkDeleteConfirm(false)} disabled={isBulkProcessing} style={{ flex: 1 }}>Cancel</button>
                <button
                  type="button" className="btn-secondary" disabled={isBulkProcessing} style={{ flex: 1, backgroundColor: "#dc2626", borderColor: "#dc2626", color: "#fff" }}
                  onClick={async () => {
                    setIsBulkProcessing(true)
                    let success = 0
                    for (const user of selectedRows) {
                      const result = await deleteUserAction({ userId: user.id })
                      if (result.success) success++
                    }
                    if (success > 0) {
                      toast.success(`${success} user${success > 1 ? "s" : ""} deleted`)
                      setRowSelection({})
                      router.refresh()
                    }
                    setIsBulkProcessing(false)
                    setShowBulkDeleteConfirm(false)
                  }}
                >
                  {isBulkProcessing ? "Deleting…" : `Delete ${count} user${count > 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Shared Contact Card slide-over — URL-driven via ?contact=<email>.
          Row click and the "Details" kebab item both call
          contactParam.open(user.email). Delete user in the panel footer
          hands off to the same check + confirm dialog as the kebab menu. */}
      <ContactCard
        email={contactParam.email}
        onDeleteUser={(userId) => {
          const row = data.find((u) => u.id === userId)
          if (!row) {
            toast.error("User not found in the current list")
            return
          }
          contactParam.close()
          void handleOpenDeleteDialog(row)
        }}
        onClose={contactParam.close}
      />
      </div>
    </>
  )
}
