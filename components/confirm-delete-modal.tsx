"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"

/**
 * Confirming something that cannot be taken back.
 *
 * Both roles type the same word, so the gesture is one habit rather
 * than two. What the word cannot tell you is *which* project, and that
 * is the mistake this guards against — so the title leads the sentence,
 * in the ink colour, where it has to be read before anything can be
 * typed.
 */
export function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  projectTitle,
  mode,
  busy = false,
  notice,
  blockers,
  loading = false,
  error = null,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  /** What is being destroyed: a project title, a company name. */
  projectTitle: string
  /** "owner" destroys the project for everyone; "leave" only ends your
   *  own credit on someone else's; "company" takes the whole company. */
  mode: "owner" | "leave" | "company"
  busy?: boolean
  /** Consequences this particular deletion carries — a company is on
   *  projects and has a team, and a project is neither. Plain lines, not
   *  boxes: the dialog already says it cannot be undone, and saying it
   *  twice in two colours reads as two problems. */
  notice?: ReactNode
  /** Reasons this cannot go ahead at all. Present means no typing and
   *  no confirming: there is nothing to confirm yet. */
  blockers?: string[]
  /** The consequences are still being worked out. */
  loading?: boolean
  /** They could not be worked out. */
  error?: string | null
}) {
  const t = useTranslations("dashboard")
  const [typed, setTyped] = useState("")

  // A fresh dialog starts empty, or the second delete needs no typing.
  useEffect(() => {
    if (open) setTyped("")
  }, [open, projectTitle])

  if (!open) return null

  const blocked = Boolean(blockers?.length) || loading || Boolean(error)
  const confirmed = !blocked && typed.trim().toUpperCase() === "DELETE"

  return (
    <div className="popup-overlay" onClick={() => !busy && onClose()}>
      <div className="popup-card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <h3 className="arco-section-title">
            {t(`delete_modal_title_${mode}`)}
          </h3>
          <button type="button" className="popup-close" onClick={onClose} aria-label="Sluiten">✕</button>
        </div>

        <p className="arco-small-text" style={{ margin: "0 0 18px" }}>
          <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{projectTitle}</strong>{" "}
          {t(`delete_modal_body_${mode}`)}
        </p>

        {notice && <div className="arco-small-text" style={{ margin: "0 0 18px" }}>{notice}</div>}

        {loading && (
          <p className="arco-small-text" style={{ margin: "0 0 18px" }}>{t("delete_modal_checking")}</p>
        )}

        {(blockers ?? []).length > 0 && (
          <ul className="arco-small-text" style={{ margin: "0 0 18px", padding: 0, listStyle: "none", color: "var(--destructive)" }}>
            {blockers!.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}

        {error && (
          <p className="arco-small-text" style={{ margin: "0 0 18px", color: "var(--destructive)" }}>{error}</p>
        )}

        {/* The softer route, named where the heavy one is being
            considered. Leaving is the only way off a project page, so
            someone who merely wants the project off their own company
            page would otherwise reach for the permanent door — it is
            the only one they can see from here. */}
        {mode === "leave" && (
          <p className="arco-small-text" style={{ margin: "0 0 18px" }}>
            {t("delete_modal_alternative_leave")}
          </p>
        )}

        {!blocked && (
          <>
        <label className="form-label" htmlFor="confirm-delete">{t("delete_modal_type")}</label>
        <input
          id="confirm-delete"
          className="form-input"
          value={typed}
          autoFocus
          autoComplete="off"
          placeholder="DELETE"
          onChange={(e) => setTyped(e.target.value)}
          style={{ marginBottom: 24 }}
        />
          </>
        )}

        <div className="popup-actions">
          <button type="button" className="btn-tertiary" style={{ flex: 1 }} onClick={onClose} disabled={busy}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="btn-tertiary"
            style={{
              flex: 1,
              color: "var(--destructive)",
              borderColor: "var(--destructive)",
              opacity: confirmed && !busy ? 1 : 0.45,
            }}
            onClick={onConfirm}
            disabled={!confirmed || busy}
          >
            {t("delete_modal_confirm")}
          </button>
        </div>
      </div>
    </div>
  )
}
