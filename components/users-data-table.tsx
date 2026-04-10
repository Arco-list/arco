"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
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
  Shield,
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
import { generateCompanyLoginLinkAction } from "@/app/admin/professionals/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import Link from "next/link"

export type AdminUserCompany = {
  id: string
  name: string
  slug: string
  companyStatus: string
  projectCount: number
}

const COMPANY_STATUS_DOT: Record<string, string> = {
  listed: "bg-emerald-500",
  unlisted: "bg-muted-foreground",
  deactivated: "bg-red-500",
}

export type AdminUserRow = {
  id: string
  displayName: string
  email: string
  avatarUrl: string | null
  companies: AdminUserCompany[]
  role: "super_admin" | "admin" | "client"
  status: "active" | "inactive" | "invited"
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
  singleActiveSuperAdmin: boolean
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
  active: "bg-emerald-500",
  invited: "bg-amber-500",
  inactive: "bg-rose-500",
}

const STATUS_LABEL: Record<AdminUserRow["status"], string> = {
  active: "Active",
  invited: "Invited",
  inactive: "Inactive",
}

const ROLE_OPTIONS: { value: AdminUserRow["role"]; label: string; description: string; dotColor: string }[] = [
  { value: "client", label: "Client", description: "Standard user account, no admin access", dotColor: "bg-[#a1a1a0]" },
  { value: "admin", label: "Admin", description: "Manage listings and professionals", dotColor: "bg-blue-500" },
  { value: "super_admin", label: "Super Admin", description: "Full access including billing and settings", dotColor: "bg-[#016D75]" },
]

const USER_STATUS_OPTIONS: { value: "active" | "inactive"; label: string; description: string; dotColor: string }[] = [
  { value: "active", label: "Active", description: "User can log in and access the platform", dotColor: "bg-emerald-500" },
  { value: "inactive", label: "Deactivated", description: "User is blocked from logging in", dotColor: "bg-rose-500" },
]

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

const formatAbsolute = (value: string | null) => {
  const date = parseDate(value)
  if (!date) return null
  return format(date, "MMM d, yyyy")
}

export function UsersDataTable({ data, singleActiveSuperAdmin }: AdminUsersTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
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
  const [roleFilter, setRoleFilter] = useState<"all" | AdminUserRow["role"]>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | AdminUserRow["status"]>("all")

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
                  <img src={row.original.avatarUrl} alt={row.original.displayName} />
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
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue || filterValue === "all") return true
          return row.getValue(columnId) === filterValue
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
                  <span className={`inline-block w-[6px] h-[6px] rounded-full shrink-0 ${COMPANY_STATUS_DOT[company.companyStatus] ?? "bg-muted-foreground"}`} />
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
                          <span className={`inline-block w-[6px] h-[6px] rounded-full shrink-0 ${COMPANY_STATUS_DOT[company.companyStatus] ?? "bg-muted-foreground"}`} />
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
        accessorKey: "status",
        header: "Status",
        size: 160,
        sortingFn: (rowA, rowB) => {
          const order = { active: 0, invited: 1, inactive: 2 }
          const statusDiff = order[rowA.original.status] - order[rowB.original.status]
          if (statusDiff !== 0) return statusDiff
          const a = rowA.original.lastSignInAt ? new Date(rowA.original.lastSignInAt).getTime() : 0
          const b = rowB.original.lastSignInAt ? new Date(rowB.original.lastSignInAt).getTime() : 0
          return b - a
        },
        cell: ({ row }) => {
          const statusDetail = (() => {
            if (row.original.status === "invited") {
              const invitedRelative = formatRelative(row.original.invitedAt)
              return invitedRelative ? `Invited ${invitedRelative}` : "Awaiting acceptance"
            }
            if (row.original.status === "inactive") {
              return row.original.bannedUntil
                ? `Suspended until ${formatAbsolute(row.original.bannedUntil)}`
                : "Access suspended"
            }
            const lastActive = formatRelative(row.original.lastSignInAt)
            return lastActive ? `Last active ${lastActive}` : "Never signed in"
          })()

          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[row.original.status])} />
                <span className="text-xs font-medium text-[#1c1c1a]">{STATUS_LABEL[row.original.status]}</span>
              </div>
              <span className="text-[11px] text-[#a1a1a0] pl-3">{statusDetail}</span>
            </div>
          )
        },
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue || filterValue === "all") return true
          return row.getValue(columnId) === filterValue
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
                    setStatusSelection(isInactive ? "active" : user.status === "active" ? "active" : "active")
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
  }, [handleResetPassword, handleOpenDeleteDialog, handleLoginAs, isGeneratingReset, resettingUserId, loggingInAsUserId])

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

  const totalAdmins = data.length
  const totalSuperAdmins = data.filter((row) => row.role === "super_admin").length

  return (
    <div className="flex flex-col gap-6 min-w-0 max-w-full overflow-hidden">
      {/* Warning banner */}
      {singleActiveSuperAdmin && (
        <div className="flex items-start gap-2.5 border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm text-amber-900">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            There is only one active super admin. Invite or promote another before demoting or deactivating the current one.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h3 className="arco-section-title">Users</h3>
        <p className="text-xs text-[#a1a1a0] mt-0.5">
          {totalAdmins} total &middot; {totalSuperAdmins} super admin{totalSuperAdmins === 1 ? "" : "s"}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center">
          <input
            type="text"
            placeholder="Search by name or email…"
            className="w-full max-w-sm px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors placeholder:text-[#a1a1a0]"
            value={searchTerm}
            onChange={(event) => {
              const value = event.target.value
              setSearchTerm(value)
              table.getColumn("displayName")?.setFilterValue(value)
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={roleFilter}
            onValueChange={(value) => {
              const next = value as typeof roleFilter
              setRoleFilter(next)
              table.getColumn("role")?.setFilterValue(next === "all" ? undefined : next)
            }}
          >
            <SelectTrigger className="w-[140px] h-9 text-xs border-[#e5e5e4] rounded-[3px]">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="super_admin">Super admins</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="client">Clients</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              const next = value as typeof statusFilter
              setStatusFilter(next)
              table.getColumn("status")?.setFilterValue(next === "all" ? undefined : next)
            }}
          >
            <SelectTrigger className="w-[140px] h-9 text-xs border-[#e5e5e4] rounded-[3px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk actions */}
      {Object.keys(rowSelection).length > 0 && (() => {
        const selectedCount = Object.keys(rowSelection).length
        return (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#f5f5f4] rounded-[3px] border border-[#e5e5e4]">
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
                    if (user.status === "active") continue
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
                  No users found. Adjust your filters or invite a new teammate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="arco-table-pagination">
        <span className="arco-table-pagination-count">
          {table.getFilteredRowModel().rows.length} user{table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
        </span>
        <div className="arco-table-pagination-nav">
          <span className="arco-table-pagination-info">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
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
              <div className="px-4 pb-2">
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
              <div className="px-4 pb-2">
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
                  (statusSelection === "active" && statusDialogUser.status === "active") ||
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

            <div className="px-4 pb-3">
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

              <div className="popup-banner popup-banner--warn">
                <AlertTriangle className="popup-banner-icon" />
                <div>
                  <p>This action cannot be undone. All data associated with this user will be permanently deleted.</p>
                </div>
              </div>
            </div>

            {isCheckingDelete ? (
              <div className="flex items-center justify-center px-4 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-[#a1a1a0]" />
                <span className="ml-2 text-xs text-[#a1a1a0]">Checking deletion requirements…</span>
              </div>
            ) : deleteCheckResult ? (
              <div className="px-4 pb-2 space-y-2">
                {deleteCheckResult.blockers.length > 0 && (
                  <div className="popup-banner popup-banner--danger">
                    <AlertTriangle className="popup-banner-icon" />
                    <div>
                      <p style={{ fontWeight: 500 }}>Cannot delete user</p>
                      {deleteCheckResult.blockers.map((blocker, idx) => (
                        <p key={idx}>{blocker}</p>
                      ))}
                    </div>
                  </div>
                )}

                {deleteCheckResult.canDelete && deleteCheckResult.warnings.length > 0 && (
                  <div className="popup-banner popup-banner--warn">
                    <AlertTriangle className="popup-banner-icon" />
                    <div>
                      <p style={{ fontWeight: 500 }}>The following data will be deleted:</p>
                      {deleteCheckResult.warnings.map((warning, idx) => (
                        <p key={idx}>{warning}</p>
                      ))}
                    </div>
                  </div>
                )}

                {deleteCheckResult.canDelete && deleteCheckResult.warnings.length === 0 && (
                  <div className="popup-banner popup-banner--info">
                    <AlertTriangle className="popup-banner-icon" />
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
                      className="w-full px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors placeholder:text-[#a1a1a0]"
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
              <div className="popup-banner popup-banner--warn">
                <AlertTriangle className="popup-banner-icon" />
                <div><p>This will permanently delete {count} user{count > 1 ? "s" : ""} and all associated data. This action cannot be undone.</p></div>
              </div>
              <div style={{ maxHeight: 160, overflowY: "auto", margin: "12px 0" }}>
                {selectedRows.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 py-1 text-xs text-[#6b6b68]">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${u.status === "active" ? "bg-emerald-500" : "bg-[#a1a1a0]"}`} />
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
    </div>
  )
}
