"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import { format, formatDistanceToNow } from "date-fns"
import {
  ColumnDef,
  ColumnFiltersState,
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
  Clock,
  Loader2,
  Mail,
  MoreHorizontal,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
} from "lucide-react"
import { toast } from "sonner"

import {
  changeAdminRoleAction,
  generateAdminResetPasswordAction,
  inviteAdminUserAction,
  toggleAdminStatusAction,
} from "@/app/admin/users/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type AdminUserRow = {
  id: string
  displayName: string
  email: string
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

const ROLE_LABELS: Record<AdminUserRow["role"], string> = {
  admin: "Admin",
  super_admin: "Super Admin",
  client: "Homeowner",
}

const STATUS_META: Record<
  AdminUserRow["status"],
  { label: string; tone: string; icon: React.ReactNode }
> = {
  active: {
    label: "Active",
    tone: "border-green-200 text-green-700 bg-green-50",
    icon: <ShieldCheck className="mr-1 h-3.5 w-3.5" />,
  },
  invited: {
    label: "Invited",
    tone: "border-amber-200 text-amber-700 bg-amber-50",
    icon: <Clock className="mr-1 h-3.5 w-3.5" />,
  },
  inactive: {
    label: "Inactive",
    tone: "border-rose-200 text-rose-700 bg-rose-50",
    icon: <ShieldAlert className="mr-1 h-3.5 w-3.5" />,
  },
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "super_admin">("admin")

  const [roleDialogUser, setRoleDialogUser] = useState<AdminUserRow | null>(null)
  const [roleSelection, setRoleSelection] = useState<"admin" | "super_admin">("admin")

  const [statusDialog, setStatusDialog] = useState<{ user: AdminUserRow; nextActive: boolean } | null>(null)

  const [resettingUserId, setResettingUserId] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | AdminUserRow["role"]>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | AdminUserRow["status"]>("all")

  const [isInviting, startInviteTransition] = useTransition()
  const [isUpdatingRole, startRoleTransition] = useTransition()
  const [isUpdatingStatus, startStatusTransition] = useTransition()
  const [isGeneratingReset, startResetTransition] = useTransition()

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

  const columns = useMemo<ColumnDef<AdminUserRow>[]>(() => {
    return [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          </div>
        ),
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
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground">
                {initials}
              </div>
              <div className="flex flex-col">
                <span className="font-medium leading-tight">{row.original.displayName}</span>
                <span className="text-sm text-muted-foreground">{row.original.email}</span>
              </div>
            </div>
          )
        },
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue) return true
          const value = `${row.getValue(columnId)} ${row.original.email}`.toLowerCase()
          return value.includes((filterValue as string).toLowerCase())
        },
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => (
          <Badge className={cn("capitalize px-2 py-1 text-xs", row.original.role === "super_admin" && "bg-primary/10 text-primary")}>
            {ROLE_LABELS[row.original.role]}
          </Badge>
        ),
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue || filterValue === "all") return true
          return row.getValue(columnId) === filterValue
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const meta = STATUS_META[row.original.status]
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
            <div className="flex flex-col">
              <span
                className={cn(
                  "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                  meta.tone,
                )}
              >
                {meta.icon}
                {meta.label}
              </span>
              <span className="text-xs text-muted-foreground mt-1">{statusDetail}</span>
            </div>
          )
        },
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue || filterValue === "all") return true
          return row.getValue(columnId) === filterValue
        },
      },
      {
        accessorKey: "lastSignInAt",
        header: "Last Activity",
        cell: ({ row }) => {
          const lastLogin = formatRelative(row.original.lastSignInAt)
          const fallback = formatRelative(row.original.createdAt)
          return (
            <div className="text-sm text-muted-foreground">
              {lastLogin ?? (row.original.status === "invited" ? "Pending activation" : fallback ?? "N/A")}
            </div>
          )
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const user = row.original
          const disableDemote = user.isLastSuperAdmin && user.role === "super_admin"
          const isInactive = user.status === "inactive"
          const nextActive = isInactive
          const disableDeactivate = (!isInactive && user.isLastSuperAdmin) || user.isSelf

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex h-8 w-8 p-0 text-muted-foreground" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    setRoleDialogUser(user)
                    setRoleSelection(user.role)
                  }}
                >
                  Update role…
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={disableDeactivate}
                  onClick={() => {
                    setStatusDialog({ user, nextActive })
                  }}
                >
                  {isInactive ? "Reactivate access" : "Deactivate access"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={user.status === "invited" || (isGeneratingReset && resettingUserId === user.id)}
                  onClick={() => handleResetPassword(user)}
                >
                  {isGeneratingReset && resettingUserId === user.id ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Reset password link
                    </span>
                  )}
                </DropdownMenuItem>
                {disableDemote && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled className="text-xs leading-tight text-muted-foreground whitespace-normal">
                      Promote another super admin to unlock demotion.
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
        enableSorting: false,
        enableHiding: false,
      },
    ]
  }, [handleResetPassword, isGeneratingReset, resettingUserId])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
  })

  const totalAdmins = data.length
  const totalSuperAdmins = data.filter((row) => row.role === "super_admin").length
  const pendingInvites = data.filter((row) => row.status === "invited").length

  const inviteDisabled = !EMAIL_REGEX.test(inviteEmail.trim())

  const handleSendInvite = () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!EMAIL_REGEX.test(email)) {
      toast.error("Enter a valid email address before sending the invite.")
      return
    }

    startInviteTransition(async () => {
      try {
        const result = await inviteAdminUserAction({ email, role: inviteRole })
        if (!result.success) {
          toast.error("Unable to send invitation", {
            description: result.error,
          })
          return
        }

        toast.success("Invitation sent", {
          description: `We emailed ${email} with setup instructions.`,
        })
        setInviteEmail("")
        setInviteRole("admin")
        setInviteDialogOpen(false)
        router.refresh()
      } catch (err) {
        console.error(err)
        toast.error("Unexpected error while sending the invitation.")
      }
    })
  }

  const handleConfirmRole = () => {
    if (!roleDialogUser) return
    if (roleSelection === roleDialogUser.role) {
      toast.info("This admin already has that role.")
      return
    }

    startRoleTransition(async () => {
      try {
        const result = await changeAdminRoleAction({
          userId: roleDialogUser.id,
          role: roleSelection,
        })

        if (!result.success) {
          toast.error("Role update failed", { description: result.error })
          return
        }

        toast.success("Role updated", {
          description: `${roleDialogUser.displayName} is now ${ROLE_LABELS[roleSelection]}.`,
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
    if (!statusDialog) return

    startStatusTransition(async () => {
      try {
        const result = await toggleAdminStatusAction({
          userId: statusDialog.user.id,
          active: statusDialog.nextActive,
        })

        if (!result.success) {
          toast.error("Status update failed", { description: result.error })
          return
        }

        toast.success(statusDialog.nextActive ? "Admin reactivated" : "Admin access revoked", {
          description: statusDialog.nextActive
            ? `${statusDialog.user.displayName} can log in again.`
            : `${statusDialog.user.displayName} can no longer access the admin.`,
        })
        setStatusDialog(null)
        router.refresh()
      } catch (err) {
        console.error(err)
        toast.error("Unexpected error while updating status.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {singleActiveSuperAdmin && (
        <div className="mx-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:mx-6">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p>
            There is only one active super admin. Invite or promote another super admin before demoting or deactivating the
            current one.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Users</h2>
            <p className="text-sm text-muted-foreground">
              {totalAdmins} total · {totalSuperAdmins} super admin{totalSuperAdmins === 1 ? "" : "s"} · {pendingInvites} pending invite
              {pendingInvites === 1 ? "" : "s"}
            </p>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite admin
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Invite a new admin</DialogTitle>
                <DialogDescription>
                  We&apos;ll send setup instructions and track the invite once they verify their email.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="invite-email">Work email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="alex@arco.com"
                    value={inviteEmail}
                    autoFocus
                    onChange={(event) => setInviteEmail(event.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <Label>Role</Label>
                  <RadioGroup
                    className="grid gap-3"
                    value={inviteRole}
                    onValueChange={(value) => setInviteRole(value as "admin" | "super_admin")}
                  >
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="invite-role-admin" className="text-sm font-medium">
                          Admin
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          Manage projects, professionals, and reviews.
                        </span>
                      </div>
                      <RadioGroupItem id="invite-role-admin" value="admin" />
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="invite-role-super-admin" className="text-sm font-medium">
                          Super Admin
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          Full access, including managing other admins.
                        </span>
                      </div>
                      <RadioGroupItem id="invite-role-super-admin" value="super_admin" />
                    </div>
                  </RadioGroup>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)} disabled={isInviting}>
                  Cancel
                </Button>
                <Button onClick={handleSendInvite} disabled={inviteDisabled || isInviting}>
                  {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <Input
              placeholder="Search by name or email…"
              className="max-w-sm"
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
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="super_admin">Super admins</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="client">Homeowners</SelectItem>
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
              <SelectTrigger className="w-[150px]">
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
      </div>

      <div className="relative flex flex-col gap-4 px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                    No admins found. Adjust your filters or invite a new teammate.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-2 border-t py-3 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
          <div>
            {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} admin
            {table.getFilteredRowModel().rows.length === 1 ? "" : "s"} selected
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium text-muted-foreground">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger id="rows-per-page" className="w-24">
                  <SelectValue placeholder={table.getState().pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                ‹
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                ›
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!roleDialogUser} onOpenChange={(open) => (!open ? setRoleDialogUser(null) : undefined)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Update admin role</DialogTitle>
            <DialogDescription>
              {roleDialogUser
                ? `Choose the access level for ${roleDialogUser.displayName}.`
                : "Select the appropriate admin access."}
            </DialogDescription>
          </DialogHeader>
          {roleDialogUser && (
            <div className="flex flex-col gap-4">
              <div className="rounded-md border border-border bg-muted/50 px-4 py-3">
                <p className="text-sm font-medium">{roleDialogUser.displayName}</p>
                <p className="text-xs text-muted-foreground">{roleDialogUser.email}</p>
              </div>
              <RadioGroup
                value={roleSelection}
                onValueChange={(value) => setRoleSelection(value as "admin" | "super_admin")}
                className="grid gap-3"
              >
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="role-admin" className="text-sm font-medium">
                      Admin
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      Manage listings, professionals, and reviews — no access to admin settings.
                    </span>
                  </div>
                  <RadioGroupItem
                    id="role-admin"
                    value="admin"
                    disabled={roleDialogUser.isLastSuperAdmin && roleDialogUser.role === "super_admin"}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="role-super-admin" className="text-sm font-medium">
                      Super Admin
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      Full access, including billing, settings, and managing other admins.
                    </span>
                  </div>
                  <RadioGroupItem id="role-super-admin" value="super_admin" />
                </div>
              </RadioGroup>
              {roleDialogUser.isLastSuperAdmin && roleDialogUser.role === "super_admin" && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Promote another super admin before demoting this user. This prevents locking the team out of high-scope
                  actions.
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setRoleDialogUser(null)} disabled={isUpdatingRole}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRole} disabled={isUpdatingRole}>
              {isUpdatingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statusDialog} onOpenChange={(open) => (!open ? setStatusDialog(null) : undefined)}>
        <DialogContent className="sm:max-w-[430px]">
          <DialogHeader>
            <DialogTitle>{statusDialog?.nextActive ? "Reactivate admin" : "Deactivate admin access"}</DialogTitle>
            <DialogDescription>
              {statusDialog?.nextActive
                ? "This admin will regain access immediately."
                : "They will be signed out and blocked from logging in."}
            </DialogDescription>
          </DialogHeader>
          {statusDialog && (
            <div className="space-y-3">
              <div className="rounded-md border border-border px-3 py-3">
                <p className="text-sm font-medium">{statusDialog.user.displayName}</p>
                <p className="text-xs text-muted-foreground">{statusDialog.user.email}</p>
              </div>
              {!statusDialog.nextActive && statusDialog.user.isLastSuperAdmin && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  This is the last active super admin. Promote or invite another super admin before deactivating.
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setStatusDialog(null)} disabled={isUpdatingStatus}>
              Cancel
            </Button>
            <Button
              variant={statusDialog?.nextActive ? "default" : "destructive"}
              onClick={handleConfirmStatus}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {statusDialog?.nextActive ? "Reactivate" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
