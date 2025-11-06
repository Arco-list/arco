"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { Database } from "@/lib/supabase/types"
import { approveReviewAction, rejectReviewAction, revertToPendingAction } from "@/app/admin/reviews/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

type ReviewStatus = Database["public"]["Enums"]["review_moderation_status"]

export type AdminReviewRow = {
  id: string
  companyId: string
  professionalName: string
  reviewerName: string
  submittedAt: string | null
  overallRating: number
  qualityRating: number | null
  reliabilityRating: number | null
  communicationRating: number | null
  workCompleted: boolean | null
  comment: string | null
  moderationStatus: ReviewStatus
  moderationNotes: string | null
  moderatedAt: string | null
  moderatorName: string | null
}

type AdminReviewsTableProps = {
  reviews: AdminReviewRow[]
  status: ReviewStatus
}

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
}

const STATUS_BADGE_CLASSES: Record<ReviewStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
}

const formatDate = (value: string | null) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

const formatBoolean = (value: boolean | null) => {
  if (value === true) return "Yes"
  if (value === false) return "No"
  return "—"
}

export const AdminReviewsTable = ({ reviews, status }: AdminReviewsTableProps) => {
  const router = useRouter()
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [rejectDialog, setRejectDialog] = useState<{ reviewId: string; note: string } | null>(null)

  const isModerating = useMemo(() => Boolean(pendingReviewId) || isPending, [pendingReviewId, isPending])

  const handleApprove = (reviewId: string) => {
    setPendingReviewId(reviewId)
    startTransition(async () => {
      const result = await approveReviewAction({ reviewId })

      if (!result.success) {
        toast.error("Unable to approve review", {
          description: result.error ?? "Please try again in a moment.",
        })
        setPendingReviewId(null)
        return
      }

      toast.success("Review approved", {
        description: "The review is now visible on the professional profile.",
      })
      setPendingReviewId(null)
      router.refresh()
    })
  }

  const handleReject = () => {
    if (!rejectDialog) return

    const { reviewId, note } = rejectDialog
    setPendingReviewId(reviewId)
    startTransition(async () => {
      const result = await rejectReviewAction({
        reviewId,
        moderationNotes: note.trim().length > 0 ? note.trim() : undefined,
      })

      if (!result.success) {
        toast.error("Unable to reject review", {
          description: result.error ?? "Please try again in a moment.",
        })
        setPendingReviewId(null)
        return
      }

      toast.success("Review rejected", {
        description: "The review will remain hidden from the public listing.",
      })
      setRejectDialog(null)
      setPendingReviewId(null)
      router.refresh()
    })
  }

  const handleRevertToPending = (reviewId: string) => {
    setPendingReviewId(reviewId)
    startTransition(async () => {
      const result = await revertToPendingAction({ reviewId })

      if (!result.success) {
        toast.error("Unable to revert review", {
          description: result.error ?? "Please try again in a moment.",
        })
        setPendingReviewId(null)
        return
      }

      toast.success("Review reverted to pending", {
        description: "The review status has been changed to pending for re-review.",
      })
      setPendingReviewId(null)
      router.refresh()
    })
  }

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/40 px-8 py-16 text-center">
        <p className="text-sm text-muted-foreground">No reviews match this filter yet.</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[140px]">Submitted</TableHead>
              <TableHead className="min-w-[200px]">Professional</TableHead>
              <TableHead className="min-w-[160px]">Reviewer</TableHead>
              <TableHead className="min-w-[180px]">Ratings</TableHead>
              <TableHead className="min-w-[220px]">Comment</TableHead>
              <TableHead className="min-w-[140px]">Status</TableHead>
              <TableHead className="min-w-[160px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.map((review) => {
              const isRowPending = pendingReviewId === review.id
              return (
                <TableRow key={review.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{formatDate(review.submittedAt)}</span>
                      <span className="text-xs text-muted-foreground">#{review.id.slice(0, 8)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{review.professionalName}</span>
                      <span className="text-xs text-muted-foreground">{review.companyId}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{review.reviewerName}</span>
                      <span className="text-xs text-muted-foreground">
                        Work carried out: {formatBoolean(review.workCompleted)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium text-foreground">Overall:</span> {review.overallRating.toFixed(1)}
                      </div>
                      <div>Quality: {review.qualityRating ?? "—"}</div>
                      <div>Reliability: {review.reliabilityRating ?? "—"}</div>
                      <div>Communication: {review.communicationRating ?? "—"}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-muted-foreground">
                      {review.comment ? review.comment : <span className="italic text-muted-foreground/80">No comment</span>}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <Badge className={STATUS_BADGE_CLASSES[review.moderationStatus]}>
                        {STATUS_LABELS[review.moderationStatus]}
                      </Badge>
                      {review.moderatedAt ? (
                        <span className="text-xs text-muted-foreground">
                          {review.moderationStatus === "approved" ? "Approved" : "Reviewed"} {formatDate(review.moderatedAt)}
                          {review.moderatorName ? ` · ${review.moderatorName}` : ""}
                        </span>
                      ) : null}
                      {review.moderationNotes ? (
                        <span className="text-xs text-muted-foreground">Notes: {review.moderationNotes}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {status === "pending" ? (
                        <>
                          <Button
                                                        variant="quaternary" size="quaternary"
                            onClick={() => handleApprove(review.id)}
                            disabled={isModerating}
                          >
                            {isRowPending && isModerating ? "Processing..." : "Approve"}
                          </Button>
                          <Button
                                                        variant="quaternary" size="quaternary"
                            onClick={() => setRejectDialog({ reviewId: review.id, note: "" })}
                            disabled={isModerating}
                          >
                            Reject
                          </Button>
                        </>
                      ) : status === "approved" ? (
                        <>
                          <Button
                                                        variant="quaternary" size="quaternary"
                            onClick={() => handleRevertToPending(review.id)}
                            disabled={isModerating}
                          >
                            {isRowPending && isModerating ? "Processing..." : "Pending"}
                          </Button>
                          <Button
                                                        variant="quaternary" size="quaternary"
                            onClick={() => setRejectDialog({ reviewId: review.id, note: "" })}
                            disabled={isModerating}
                          >
                            Reject
                          </Button>
                        </>
                      ) : status === "rejected" ? (
                        <>
                          <Button
                                                        variant="quaternary" size="quaternary"
                            onClick={() => handleApprove(review.id)}
                            disabled={isModerating}
                          >
                            {isRowPending && isModerating ? "Processing..." : "Approve"}
                          </Button>
                          <Button
                                                        variant="quaternary" size="quaternary"
                            onClick={() => handleRevertToPending(review.id)}
                            disabled={isModerating}
                          >
                            {isRowPending && isModerating ? "Processing..." : "Pending"}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={rejectDialog !== null} onOpenChange={(open) => (!open ? setRejectDialog(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject review</DialogTitle>
            <DialogDescription>
              Optionally explain why this review is being rejected. Homeowners will not see internal notes.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Add moderation notes (optional)"
            value={rejectDialog?.note ?? ""}
            onChange={(event) =>
              setRejectDialog((prev) => (prev ? { ...prev, note: event.target.value.slice(0, 1000) } : prev))
            }
            rows={4}
            maxLength={1000}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="quaternary" size="quaternary"
              onClick={() => setRejectDialog(null)}
              disabled={isModerating}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleReject} disabled={isModerating}>
              {isModerating ? "Rejecting..." : "Reject review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
