"use client"

import { AlertTriangle } from "lucide-react"
import { useTranslations } from "next-intl"

import { translateRejectionReason } from "@/lib/rejection-reasons"

/**
 * What happened, and what can be done about it.
 *
 * Shown once when the owner opens a rejected project. The reason has
 * always been in the database and in the rejection email; what was
 * missing was the reason appearing where somebody could act on it —
 * on the page with the work in it.
 *
 * Deliberately has no resubmit button. Nothing has changed yet at the
 * moment this opens: offering to send the project back to a reviewer
 * before its owner has touched anything invites exactly the round trip
 * the rejection was meant to end. The action lives in the toolbar and
 * in the status dialog, where it belongs after the editing.
 *
 * So this tells and does not ask, and closes with an ✕ rather than a
 * choice — there is nothing here to decide.
 */

type Props = {
  open: boolean
  onClose: () => void
  rejectionReason: string | null
}

export function RejectedNoticeModal({ open, onClose, rejectionReason }: Props) {
  const t = useTranslations("project_edit.submit_review")
  const tReason = useTranslations("project_status.rejection_reasons")

  if (!open) return null

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="popup-header">
          <h3 className="arco-section-title">{t("rejected_title")}</h3>
          <button type="button" className="popup-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* The reviewer's own words. Admins tick from a fixed list that
            is stored in English, so this maps the known phrases back to
            the reader's language and passes a hand-typed note through
            untouched rather than mangling it. */}
        {rejectionReason && (
          <div className="arco-alert arco-alert--danger status-modal-alert">
            <AlertTriangle className="arco-alert-icon" />
            <div>
              <p>{translateRejectionReason(rejectionReason, tReason)}</p>
            </div>
          </div>
        )}

        <p className="form-note" style={{ marginTop: 16, marginBottom: 0 }}>
          {t("rejected_what_now")}
        </p>
      </div>
    </div>
  )
}
