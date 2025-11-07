"use client"

import { useMemo } from "react"
import Link from "next/link"
import { AlertTriangle, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"

type PlanTier = "basic" | "plus"

export type ListingStatusModalOption<T extends string> = {
  value: T
  label: string
  description: string
  colorClass: string
  requiresPlus?: boolean
}

export type ListingStatusModalProject = {
  title: string
  descriptor: string
  coverImageUrl: string
  planBadgeLabel?: string
}

type ListingStatusModalProps<TStatus extends string> = {
  open: boolean
  onClose: () => void
  onSave: () => void
  project: ListingStatusModalProject | null
  companyPlan: PlanTier
  selectedStatus: TStatus | ""
  onStatusChange: (status: TStatus) => void
  statusOptions: ReadonlyArray<ListingStatusModalOption<TStatus>>
  saveDisabled?: boolean
  isPendingAdminReview?: boolean
  limitReachedForNewActivation?: boolean
  activeStatusValues?: ReadonlyArray<TStatus>
  role?: "owner" | "contributor"
}

export function ListingStatusModal<TStatus extends string>({
  open,
  onClose,
  onSave,
  project,
  companyPlan,
  selectedStatus,
  onStatusChange,
  statusOptions,
  saveDisabled = false,
  isPendingAdminReview = false,
  limitReachedForNewActivation = false,
  activeStatusValues = [],
  role = "owner",
}: ListingStatusModalProps<TStatus>) {
  const activeStatusSet = useMemo(() => new Set(activeStatusValues), [activeStatusValues])

  if (!project) {
    return null
  }

  const planBadgeLabel = project.planBadgeLabel ?? (companyPlan === "plus" ? "Plus plan" : "Basic plan")
  const planBadgeClass =
    companyPlan === "plus" ? "bg-emerald-100 text-emerald-700" : "bg-surface text-text-secondary"

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-md border-none bg-transparent p-0 shadow-none">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-foreground">
              {role === "contributor" ? "Update listing status" : "Listing status"}
            </h4>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground transition-colors hover:text-text-secondary"
              aria-label="Close listing status"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <img
              src={project.coverImageUrl}
              alt={project.title}
              className="w-16 h-16 rounded-lg object-cover bg-surface"
            />
            <div className="space-y-1">
              <h6 className="text-foreground">{project.title}</h6>
              <p className="text-sm text-text-secondary">{project.descriptor}</p>
            </div>
          </div>

          {isPendingAdminReview && (
            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 mb-5 text-sm text-blue-800">
              <AlertTriangle className="h-5 w-5 mt-0.5 text-blue-600" />
              <div>
                <p className="font-medium">Under review by the Arco team</p>
                <p className="text-blue-700">
                  We&apos;ll email you once the review is complete. Status changes are disabled until approval.
                </p>
              </div>
            </div>
          )}

          {limitReachedForNewActivation && !isPendingAdminReview && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 mb-5 text-sm text-amber-800">
              <AlertTriangle className="h-5 w-5 mt-0.5" />
              <div>
                <p className="font-medium">You&apos;ve reached the Basic plan limit.</p>
                <p className="text-amber-700">Unlist another project or upgrade to Plus to set this listing live.</p>
              </div>
            </div>
          )}

          <div className="space-y-3 mb-6">
            {statusOptions.map((option) => {
              const isSelected = selectedStatus === option.value
              const requiresPlus = option.requiresPlus === true
              const isPlusLocked = requiresPlus && companyPlan !== "plus"
              const wouldBeActive = activeStatusSet.has(option.value)
              const hitsActiveLimit = limitReachedForNewActivation && wouldBeActive
              const isDisabled = isPlusLocked || hitsActiveLimit || isPendingAdminReview
              const showUpgradeLink = isPlusLocked && !isPendingAdminReview
              const description = isPendingAdminReview
                ? option.description
                : requiresPlus && companyPlan !== "plus"
                    ? "Upgrade to Plus to make this project searchable on Discover."
                    : option.description

              return (
                <label
                  key={option.value}
                  className={`block p-4 border rounded-lg transition-colors ${
                    isSelected ? "border-foreground bg-surface" : "border-border hover:border-border"
                  } ${isDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                  aria-disabled={isDisabled}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="listing-status"
                      value={option.value}
                      checked={isSelected}
                      onChange={() => {
                        if (!isDisabled) {
                          onStatusChange(option.value)
                        }
                      }}
                      disabled={isDisabled}
                      className="sr-only"
                    />
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${option.colorClass}`} />
                        <span className="font-medium text-foreground">{option.label}</span>
                        {requiresPlus && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                              companyPlan === "plus"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {companyPlan === "plus" ? "Included in Plus" : "Plus"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-text-secondary">{description}</p>
                      {showUpgradeLink && (
                        <div className="flex items-center gap-2 text-sm text-amber-700">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Upgrade to Plus to unlock this status.</span>
                        </div>
                      )}
                      {hitsActiveLimit && (
                        <div className="flex items-center gap-2 text-sm text-red-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Basic plan allows up to three live listings.</span>
                        </div>
                      )}
                    </div>
                    {showUpgradeLink && (
                      <Link
                        href="/dashboard/pricing"
                        className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Upgrade
                      </Link>
                    )}
                  </div>
                </label>
              )
            })}
          </div>

          <div className="flex gap-3">
            <Button variant="tertiary" size="tertiary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button variant="secondary" size="sm" onClick={onSave} className="flex-1" disabled={saveDisabled}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ListingStatusModal
