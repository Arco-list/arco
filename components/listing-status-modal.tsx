"use client"

import { AlertTriangle } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslations } from "next-intl"

import { translateRejectionReason } from "@/lib/rejection-reasons"

export type ListingStatusModalOption<T extends string> = {
  value: T
  label: string
  description: string
  colorClass: string
}

export type ListingStatusModalProject = {
  title: string
  descriptor: string
  coverImageUrl: string
}

type ListingStatusModalProps<TStatus extends string> = {
  open: boolean
  onClose: () => void
  onSave: () => void
  project: ListingStatusModalProject | null
  selectedStatus: TStatus | ""
  onStatusChange: (status: TStatus) => void
  statusOptions: ReadonlyArray<ListingStatusModalOption<TStatus>>
  saveDisabled?: boolean
  isPendingAdminReview?: boolean
  isRejected?: boolean
  rejectionReason?: string | null
  isDraft?: boolean
  onSubmitForReview?: () => void
  isSubmittingForReview?: boolean
  limitReachedForNewActivation?: boolean
  activeStatusValues?: ReadonlyArray<TStatus>
  role?: "owner" | "contributor"
  /** Offered below the main choice, behind a rule: acts of a different
   *  kind that should not sit among the everyday ones. */
  secondaryOptions?: ReadonlyArray<ListingStatusModalOption<TStatus>>
  /** A consequence the reader cannot see for themselves — which other
   *  project loses its place, for instance. */
  note?: ReactNode
}

export function ListingStatusModal<TStatus extends string>({
  open,
  onClose,
  onSave,
  project,
  selectedStatus,
  onStatusChange,
  statusOptions,
  saveDisabled = false,
  isPendingAdminReview = false,
  isRejected = false,
  rejectionReason,
  isDraft = false,
  onSubmitForReview,
  isSubmittingForReview = false,
  secondaryOptions,
  note,
}: ListingStatusModalProps<TStatus>) {
  const t = useTranslations("dashboard")
  const tReason = useTranslations("project_status.rejection_reasons")

  if (!open || !project) {
    return null
  }

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="popup-header">
          <h3 className="arco-section-title">{t("status_modal_title")}</h3>
          <button type="button" className="popup-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {isDraft && !isPendingAdminReview && (
          <div className="arco-alert arco-alert--info">
            <AlertTriangle className="arco-alert-icon" />
            <div>
              <p style={{ fontWeight: 500 }}>{t("status_modal_draft")}</p>
              <p>
                {t("status_modal_draft_description")}
              </p>
            </div>
          </div>
        )}

        {isPendingAdminReview && (
          <div className="arco-alert arco-alert--info">
            <AlertTriangle className="arco-alert-icon" />
            <div>
              <p style={{ fontWeight: 500 }}>{t("status_modal_under_review")}</p>
              <p>
                {t("status_modal_under_review_description")}
              </p>
            </div>
          </div>
        )}

        {isRejected && (
          <div className="arco-alert arco-alert--danger status-modal-alert">
            <AlertTriangle className="arco-alert-icon" />
            <div>
              <p style={{ fontWeight: 500 }}>{t("status_modal_rejected")}</p>
              {rejectionReason && (
                <p>{translateRejectionReason(rejectionReason, tReason)}</p>
              )}
            </div>
          </div>
        )}

        <div className="status-modal-options">
          {statusOptions.map((option) => {
            const isSelected = selectedStatus === option.value
            const isDisabled = isPendingAdminReview || isDraft || isRejected

            return (
              <button
                key={option.value}
                type="button"
                className={`status-modal-option${isSelected ? " selected" : ""}`}
                disabled={isDisabled}
                onClick={() => onStatusChange(option.value)}
              >
                <span className={`status-modal-dot ${option.colorClass}`} />
                <div className="status-modal-option-text">
                  <span className="status-modal-option-label">{option.label}</span>
                  <span className="status-modal-option-desc">{option.description}</span>
                </div>
              </button>
            )
          })}
        </div>

        {note && (
          <p className="form-note" style={{ margin: "-10px 0 16px" }}>{note}</p>
        )}

        {secondaryOptions && secondaryOptions.length > 0 && (
          <div style={{ borderTop: "1px solid var(--arco-light-grey)", paddingTop: 16, marginBottom: 20 }}>
            {/* One line until it is chosen. A full card here competed
                with the two real choices above it, and its warning —
                your name comes off someone else's project — is only
                worth reading at the moment you are about to accept it,
                which is exactly when it appears. */}
            <div className="status-modal-options" style={{ margin: 0 }}>
              {secondaryOptions.map((option) => {
                const isSelected = selectedStatus === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`status-modal-option${isSelected ? " selected" : ""}`}
                    style={isSelected ? undefined : { border: "none", background: "none", padding: "4px 0" }}
                    disabled={isPendingAdminReview || isDraft || isRejected}
                    onClick={() => onStatusChange(option.value)}
                  >
                    <span className={`status-modal-dot ${option.colorClass}`} />
                    <div className="status-modal-option-text">
                      <span
                        className="status-modal-option-label"
                        style={isSelected ? undefined : { fontWeight: 400, color: "var(--arco-mid)" }}
                      >
                        {option.label}
                      </span>
                      {isSelected && (
                        <span className="status-modal-option-desc">{option.description}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="popup-actions">
          {isDraft && onSubmitForReview ? (
            <>
              <button type="button" className="btn-tertiary" onClick={onClose} style={{ flex: 1 }}>
                {t("cancel")}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={onSubmitForReview}
                disabled={isSubmittingForReview}
                style={{ flex: 1, ...(isSubmittingForReview ? { opacity: 0.5 } : undefined) }}
              >
                {isSubmittingForReview ? t("status_modal_submitting") : t("status_modal_submit")}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-tertiary" onClick={onClose} style={{ flex: 1 }}>
                {t("cancel")}
              </button>
              <button type="button" className="btn-secondary" onClick={onSave} disabled={saveDisabled} style={{ flex: 1 }}>
                {t("save")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

