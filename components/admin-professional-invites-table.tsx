"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import {
  Archive,
  Ban,
  Clock3,
  ListChecks,
  Mail,
  RefreshCcw,
  Search,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { resendProfessionalInviteAction } from "@/app/admin/professionals/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { Database } from "@/lib/supabase/types"

type InviteStatus = Database["public"]["Enums"]["professional_project_status"]

export type AdminInviteRow = {
  id: string
  invitedEmail: string
  invitedAt: string | null
  status: InviteStatus
  projectTitle: string | null
  projectStatus: Database["public"]["Enums"]["project_status"] | null
  respondedAt: string | null
}

type Props = {
  invites: AdminInviteRow[]
}

type StatusFilterValue = "all" | InviteStatus

const inviteStatusStyles: Record<InviteStatus, { label: string; tone: string; icon: LucideIcon }> = {
  invited: { label: "Not claimed", tone: "bg-amber-100 text-amber-800", icon: Clock3 },
  listed: { label: "Listed", tone: "bg-blue-100 text-blue-800", icon: ListChecks },
  live_on_page: { label: "Live", tone: "bg-emerald-100 text-emerald-700", icon: Sparkles },
  unlisted: { label: "Unlisted", tone: "bg-surface text-text-secondary", icon: Archive },
  rejected: { label: "Rejected", tone: "bg-rose-100 text-rose-700", icon: XCircle },
  removed: { label: "Removed", tone: "bg-surface text-foreground", icon: Ban },
}

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "invited", label: inviteStatusStyles.invited.label },
  { value: "listed", label: inviteStatusStyles.listed.label },
  { value: "live_on_page", label: inviteStatusStyles.live_on_page.label },
  { value: "unlisted", label: inviteStatusStyles.unlisted.label },
  { value: "rejected", label: inviteStatusStyles.rejected.label },
  { value: "removed", label: inviteStatusStyles.removed.label },
] satisfies Array<{ value: StatusFilterValue; label: string }>

const formatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const PAGE_SIZE_OPTIONS = [10, 25, 50]

function getInviteTimestamps(value: string | null) {
  if (!value) {
    return { absolute: "—", relative: null as string | null }
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return { absolute: "—", relative: null as string | null }
  }

  return {
    absolute: formatter.format(date),
    relative: formatDistanceToNow(date, { addSuffix: true }),
  }
}

export function AdminProfessionalInvitesTable({ invites }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all")
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])

  const filteredInvites = useMemo(() => {
    const lowered = search.trim().toLowerCase()

    return invites.filter((invite) => {
      const matchesStatus = statusFilter === "all" || invite.status === statusFilter
      if (!matchesStatus) return false

      if (!lowered) return true

      const statusLabel = inviteStatusStyles[invite.status]?.label ?? invite.status
      const haystack = [invite.invitedEmail, invite.projectTitle ?? "", statusLabel]
        .join(" ")
        .toLowerCase()

      return haystack.includes(lowered)
    })
  }, [invites, search, statusFilter])

  useEffect(() => {
    setPage(0)
  }, [search, pageSize, invites.length, statusFilter])

  const pageCount = Math.max(1, Math.ceil(filteredInvites.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const pageItems = filteredInvites.slice(currentPage * pageSize, currentPage * pageSize + pageSize)

  const handleResend = (inviteId: string, invitedEmail: string) => {
    setPendingId(inviteId)
    startTransition(async () => {
      try {
        const result = await resendProfessionalInviteAction({ inviteId })
        if (!result.success) {
          toast.error(result.error ?? "Failed to resend invite")
          return
        }

        toast.success(`Invite resent to ${invitedEmail}`)
        router.refresh()
      } catch (error) {
        console.error("Failed to resend invite", error)
        toast.error("Failed to resend invite")
      } finally {
        setPendingId(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="heading-4">Invites</h3>
        <p className="body-small text-muted-foreground">
          Review pending invitations and keep company listings in sync with project statuses.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full flex-1 md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email or project"
            className="h-9 rounded-md pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilterValue)}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent align="end">
              {STATUS_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="quaternary" size="quaternary" className="h-9 gap-2" onClick={() => router.refresh()}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[240px]">Email</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="w-[220px]">Invited</TableHead>
              <TableHead className="w-[180px]">Status</TableHead>
              <TableHead className="w-[170px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center body-small text-muted-foreground">
                  No invites match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((invite) => {
                const statusInfo = inviteStatusStyles[invite.status]
                const StatusIcon = statusInfo.icon
                const invitedAt = getInviteTimestamps(invite.invitedAt)
                const projectLabel = invite.projectTitle ?? "Untitled project"
                const projectStatusLabel = invite.projectStatus?.replace(/_/g, " ") ?? null
                const respondedRelative = invite.respondedAt
                  ? (() => {
                      const respondedDate = new Date(invite.respondedAt)
                      return Number.isNaN(respondedDate.getTime())
                        ? null
                        : formatDistanceToNow(respondedDate, { addSuffix: true })
                    })()
                  : null

                return (
                  <TableRow key={invite.id}>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1 body-small">
                        <span className="font-medium text-foreground break-words">{invite.invitedEmail}</span>
                        {respondedRelative ? (
                          <span className="text-xs text-muted-foreground">Responded {respondedRelative}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 body-small">
                        <span className="font-medium text-foreground">{projectLabel}</span>
                        {projectStatusLabel ? (
                          <span className="inline-flex items-center gap-1 text-xs capitalize text-muted-foreground">
                            <ListChecks className="h-3 w-3" />
                            {projectStatusLabel}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col body-small">
                        <span className="font-medium text-foreground">{invitedAt.absolute}</span>
                        {invitedAt.relative ? (
                          <span className="text-xs text-muted-foreground">{invitedAt.relative}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="quaternary" size="quaternary"
                        className={cn("inline-flex items-center gap-1.5 border-none px-2.5 py-1 text-xs font-medium", statusInfo.tone)}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="quaternary" size="quaternary"
                        className="h-8 gap-1.5"
                        disabled={isPending && pendingId === invite.id}
                        onClick={() => handleResend(invite.id, invite.invitedEmail)}
                      >
                        <Mail className="h-4 w-4" />
                        Resend invite
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 body-small text-muted-foreground">
        <div>
          Showing {pageItems.length} of {filteredInvites.length} invites
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="invites-rows" className="heading-7 text-foreground">
              Rows per page
            </Label>
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger id="invites-rows" className="h-8 w-20">
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
    </div>
  )
}
