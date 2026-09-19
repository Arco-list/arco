"use client"

import type { ReactNode } from "react"
import { Check, ImageIcon, Lock, MoreHorizontal } from "lucide-react"
import { useTranslations } from "next-intl"

/**
 * A project as it appears to the company that owns or is credited on it.
 *
 * Lived twice — once on Listings, once under "Uitgelichte projecten" on
 * the company edit page — and the copies had drifted: one had the lock
 * for the free allowance and the delete actions, the other had an
 * untranslated "Accept" and a hover overlay a shade lighter. Same card
 * in the reader's eyes, so: one component.
 *
 * It owns the menu rather than taking one, because the menu is the part
 * that drifted worst. A page supplies what each action DOES; what the
 * actions ARE, and what they are called, is settled here.
 */

export type ListingCardRole = "owner" | "contributor"

export type ListingCardProps = {
  title: string
  coverImageUrl: string | null
  /** The line under the title: type · city · whatever the page adds. */
  meta?: ReactNode
  statusLabel: string
  statusDotClass: string
  role: ListingCardRole
  /** Credited but not yet accepted — the card advertises Accept. */
  invited?: boolean
  /** Credited, but the free allowance is spent on another project. */
  locked?: boolean

  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void

  /** Click on the card body. */
  onOpen: () => void
  onStatusClick: () => void
  onAccept?: () => void
  onUpgrade?: () => void

  /** Owner only; the menu item is dropped when it is absent. */
  onEditListing?: () => void
  onUpdateStatus: () => void
  onChangeCover: () => void
  /** Absent for a project with no public page yet. */
  viewUrl?: string | null
  /** Owner: delete the project. Contributor: leave it. */
  onDelete: () => void
}

const PILL: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7,
  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 400,
  color: "#fff", border: "1px solid rgba(255,255,255,.25)", borderRadius: 100,
  padding: "8px 18px",
  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
}

export function ListingCard({
  title,
  coverImageUrl,
  meta,
  statusLabel,
  statusDotClass,
  role,
  invited = false,
  locked = false,
  menuOpen,
  onMenuOpenChange,
  onOpen,
  onStatusClick,
  onAccept,
  onUpgrade,
  onEditListing,
  onUpdateStatus,
  onChangeCover,
  viewUrl,
  onDelete,
}: ListingCardProps) {
  const t = useTranslations("listing_card")

  const actions = [
    ...(role === "owner" && onEditListing ? [{ key: "edit", label: t("edit_project"), run: onEditListing }] : []),
    { key: "status", label: t("update_status"), run: onUpdateStatus },
    { key: "cover", label: t("change_cover"), run: onChangeCover },
    ...(viewUrl ? [{ key: "view", label: t("view_project"), run: () => window.open(viewUrl, "_blank", "noopener,noreferrer") }] : []),
    // Last, and marked: everything above is harmless, this one is not.
    { key: "delete", label: role === "owner" ? t("delete_project") : t("leave_project"), run: onDelete, destructive: true },
  ]

  return (
    <div
      className="discover-card"
      style={{ position: "relative", cursor: "pointer" }}
      onClick={(e) => {
        if (!(e.target as Element).closest(".dropdown-menu")) onOpen()
      }}
    >
      <div
        className="discover-card-image-wrap"
        style={{ position: "relative" }}
        onMouseEnter={(e) => {
          const overlay = e.currentTarget.querySelector<HTMLElement>(".listing-card-hover-overlay")
          const pill = e.currentTarget.querySelector<HTMLElement>(".listing-card-hover-pill")
          if (overlay && !locked) overlay.style.background = "rgba(0,0,0,.35)"
          if (pill) pill.style.opacity = "1"
        }}
        onMouseLeave={(e) => {
          const overlay = e.currentTarget.querySelector<HTMLElement>(".listing-card-hover-overlay")
          const pill = e.currentTarget.querySelector<HTMLElement>(".listing-card-hover-pill")
          if (overlay && !locked) overlay.style.background = "transparent"
          if (pill) pill.style.opacity = "0"
        }}
      >
        <div className="discover-card-image-layer">
          {coverImageUrl ? (
            <img src={coverImageUrl} alt={title} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#c8c8c6", background: "var(--arco-surface)" }}>
              <ImageIcon size={32} />
            </div>
          )}
        </div>

        {/* Its own layer, always dark. The hover overlay below stays out
            of the way for these cards — the badge grows and the image
            zooms, but the ground does not change, because the state it
            represents did not change either. */}
        {locked && (
          <div className="listing-card-locked-overlay">
            <span
              className="listing-card-lock-badge"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onUpgrade?.()
              }}
            >
              <Lock size={13} strokeWidth={1.75} />
              <span className="listing-card-lock-label">{t("upgrade_for_unlimited")}</span>
            </span>
          </div>
        )}

        {invited && (
          <button
            style={{
              position: "absolute", inset: 0, zIndex: 2,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", border: "none", cursor: "pointer",
              transition: "background .2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,.35)"
              const pill = e.currentTarget.querySelector<HTMLElement>("[data-accept-pill]")
              if (pill) { pill.style.opacity = "1"; pill.style.background = "rgba(0,0,0,.6)"; pill.style.borderColor = "rgba(255,255,255,.4)" }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent"
              const pill = e.currentTarget.querySelector<HTMLElement>("[data-accept-pill]")
              if (pill) { pill.style.opacity = "0.7"; pill.style.background = "rgba(0,0,0,.45)"; pill.style.borderColor = "rgba(255,255,255,.25)" }
            }}
            onClick={(e) => {
              e.stopPropagation()
              onAccept?.()
            }}
          >
            <span
              data-accept-pill=""
              style={{
                ...PILL,
                background: "rgba(0,0,0,.45)",
                opacity: 0.7, transition: "opacity .2s, background .2s, border-color .2s",
              }}
            >
              <Check size={14} />
              {t("accept")}
            </span>
          </button>
        )}

        {/* Hover action pill. Not on a locked card: the lock badge
            occupies the same spot, and both rendering left two frames
            stacked on hover. */}
        {!invited && !locked && (
          <div
            className="listing-card-hover-overlay"
            style={{
              position: "absolute", inset: 0, zIndex: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", transition: "background .2s",
              pointerEvents: "none",
            }}
          >
            <span
              className="listing-card-hover-pill"
              style={{ ...PILL, background: "rgba(0,0,0,.6)", opacity: 0, transition: "opacity .2s" }}
            >
              {role === "owner" ? t("edit_project") : t("change_cover")}
            </span>
          </div>
        )}

        {role === "owner" && (
          <span
            style={{
              position: "absolute", bottom: 10, left: 10, zIndex: 2,
              display: "inline-flex", alignItems: "center",
              fontSize: 11, fontWeight: 500, color: "#fff",
              background: "rgba(0,0,0,.45)", borderRadius: 100,
              padding: "4px 10px", letterSpacing: ".02em",
              backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            }}
          >
            {t("owner")}
          </span>
        )}
      </div>

      {/* Status pill — overlaid on the image, always clickable. */}
      <div style={{ position: "absolute", top: 12, left: 12, zIndex: 2, display: "flex", gap: 6 }}>
        <button
          className="filter-pill flex items-center gap-1.5"
          onClick={(e) => { e.stopPropagation(); onStatusClick() }}
        >
          <span className={`inline-block w-[7px] h-[7px] rounded-full shrink-0 ${statusDotClass}`} />
          <span className="text-xs font-medium">{statusLabel}</span>
        </button>
      </div>

      <div
        className="dropdown-menu"
        style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="filter-pill"
          onClick={() => onMenuOpenChange(!menuOpen)}
          data-open={menuOpen ? "true" : undefined}
          aria-label={t("options_aria")}
          style={{ padding: "6px 8px", gap: 0 }}
        >
          <MoreHorizontal style={{ width: 16, height: 16 }} />
        </button>
        <div
          className="filter-dropdown"
          data-open={menuOpen ? "true" : undefined}
          data-align="right"
          style={{ minWidth: 180, top: "calc(100% + 6px)" }}
        >
          {actions.map(({ key, label, run, destructive }) => (
            <div
              key={key}
              className={`filter-dropdown-option${destructive ? " filter-dropdown-option--destructive" : ""}`}
              onClick={() => { onMenuOpenChange(false); run() }}
              role="menuitem"
            >
              <span className="filter-dropdown-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <h3 className="discover-card-title">{title}</h3>
      {meta}
    </div>
  )
}
