"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { IconClockPlay, IconMailForward, IconSparkles } from "@tabler/icons-react"
import { toast } from "sonner"

import { resendProfessionalInviteAction } from "@/app/admin/professionals/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Database } from "@/lib/supabase/types"

export type AdminInviteRow = {
  id: string
  invitedEmail: string
  invitedAt: string | null
  status: Database["public"]["Enums"]["professional_project_status"]
  projectTitle: string | null
  projectStatus: Database["public"]["Enums"]["project_status"] | null
  respondedAt: string | null
}

type Props = {
  invites: AdminInviteRow[]
}

const statusLabels: Record<Database["public"]["Enums"]["professional_project_status"], string> = {
  invited: "Not claimed",
  listed: "Listed",
  live_on_page: "Live",
  unlisted: "Unlisted",
  rejected: "Rejected",
  removed: "Removed",
}

const formatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const PAGE_SIZE_OPTIONS = [10, 25, 50]

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return formatter.format(date)
}

export function AdminProfessionalInvitesTable({ invites }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])

  const filteredInvites = useMemo(() => {
    if (!search.trim()) return invites
    const lowered = search.trim().toLowerCase()
    return invites.filter((invite) => {
      const haystack = [invite.invitedEmail, invite.projectTitle ?? "", invite.status ?? ""].join(" ").toLowerCase()
      return haystack.includes(lowered)
    })
  }, [invites, search])

  useEffect(() => {
    setPage(0)
  }, [search, pageSize, invites.length])

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
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold leading-none tracking-tight">Invites</h2>
          <p className="text-sm text-muted-foreground">
            Pending invitations that have not been claimed yet.
          </p>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by email or project"
          className="max-w-xs"
        />
      </div>
      <div className="flex-1 overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/60">
            <TableRow>
              <TableHead className="min-w-[220px]">Email</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Invited on</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[160px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  No pending invites found.
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((invite) => {
                const label = statusLabels[invite.status] ?? invite.status
                const isClaimed = invite.status !== "invited"
                const projectLabel = invite.projectTitle ?? "Untitled project"

                return (
                  <TableRow key={invite.id}>
                    <TableCell className="align-top text-sm font-medium">{invite.invitedEmail}</TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span className="font-medium">{projectLabel}</span>
                        {invite.projectStatus ? (
                          <span className="text-muted-foreground text-xs capitalize">{invite.projectStatus.replace(/_/g, " ")}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(invite.invitedAt)}</TableCell>
                    <TableCell>
                      <Badge variant={isClaimed ? "secondary" : "outline"} className="gap-1">
                        {isClaimed ? <IconSparkles className="size-3" /> : <IconClockPlay className="size-3" />}
                        {label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        disabled={isPending && pendingId === invite.id}
                        onClick={() => handleResend(invite.id, invite.invitedEmail)}
                      >
                        <IconMailForward className="size-4" />
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
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div>Showing {pageItems.length} of {filteredInvites.length} invites</div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="invites-rows" className="text-sm font-medium text-foreground">
              Rows per page
            </Label>
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger id="invites-rows" className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setPage(0)}
              disabled={currentPage === 0}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
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
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setPage((prev) => Math.min(pageCount - 1, prev + 1))}
              disabled={currentPage + 1 >= pageCount}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
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
