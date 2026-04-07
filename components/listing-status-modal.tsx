"use client"

import { AlertTriangle } from "lucide-react"
import { useTranslations } from "next-intl"

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
  companyPlan?: string
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
}: ListingStatusModalProps<TStatus>) {
  const t = useTranslations("dashboard")

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
          <div className="popup-banner popup-banner--info">
            <AlertTriangle className="popup-banner-icon" />
            <div>
              <p style={{ fontWeight: 500 }}>{t("status_modal_draft")}</p>
              <p>
                {t("status_modal_draft_description")}
              </p>
            </div>
          </div>
        )}

        {isPendingAdminReview && (
          <div className="popup-banner popup-banner--info">
            <AlertTriangle className="popup-banner-icon" />
            <div>
              <p style={{ fontWeight: 500 }}>{t("status_modal_under_review")}</p>
              <p>
                {t("status_modal_under_review_description")}
              </p>
            </div>
          </div>
        )}

        {isRejected && (
          <div className="popup-banner popup-banner--danger">
            <AlertTriangle className="popup-banner-icon" />
            <div>
              <p style={{ fontWeight: 500 }}>{t("status_modal_rejected")}</p>
              {rejectionReason && (
                <p>{rejectionReason}</p>
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

