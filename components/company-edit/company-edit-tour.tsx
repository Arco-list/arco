"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"

export type TourStep = {
  anchor: string
  titleKey: string
  bodyKey: string
  placement?: "top" | "bottom"
}

interface CompanyEditTourProps {
  /** Identifier to scope the localStorage "seen" flag. For the company
   *  edit page pass companyId; for the project edit page pass projectId.
   *  Different ids means the tour re-triggers on each new target. */
  companyId: string
  enabled: boolean
  steps: TourStep[]
  /** next-intl namespace containing step_of/next/back/finish/skip plus
   *  the titleKey/bodyKey entries the steps refer to. Defaults to
   *  "company_edit.tour"; project tour passes "project_edit.tour". */
  namespace?: string
  /** Distinct storage-key prefix so the company + project tours don't
   *  share the same "seen" state. */
  storagePrefix?: string
  /** Fires once when the tour ends — via Finish, Skip, or a mount-time
   *  "already seen" bail-out. Parent uses this to trigger the next step
   *  in the onboarding flow (e.g. the first-project popup). Never fires
   *  more than once per mount. */
  onFinish?: () => void
  /** Fires whenever the visible step changes (including on start and on
   *  end). Parent uses this to run per-step side effects — e.g. opening
   *  a picker so the highlighted element does something interesting
   *  while the tour points at it. `null` means the tour is no longer
   *  visible (finished or not yet active). */
  onStepChange?: (stepIndex: number | null) => void
}

const DEFAULT_STORAGE_PREFIX = "arco.company-edit-tour.seen."

const HIGHLIGHT_PADDING = 8
const CARD_WIDTH = 360
const CARD_GAP = 16
const VIEWPORT_MARGIN = 16

// Highlight rect (in viewport coords) + where to anchor the tooltip card
// vertically relative to that rect. Both computed together so a single
// getBoundingClientRect pass drives them.
type Layout = {
  spot: { top: number; left: number; width: number; height: number }
  card: { top: number; left: number; placement: "top" | "bottom" }
}

function measure(target: HTMLElement, prefer: "top" | "bottom" | undefined): Layout {
  const rect = target.getBoundingClientRect()
  const spot = {
    top: rect.top - HIGHLIGHT_PADDING,
    left: rect.left - HIGHLIGHT_PADDING,
    width: rect.width + HIGHLIGHT_PADDING * 2,
    height: rect.height + HIGHLIGHT_PADDING * 2,
  }
  const spaceBelow = window.innerHeight - (spot.top + spot.height)
  const spaceAbove = spot.top
  // Cards need roughly 180px; if the caller prefers a side but there's
  // not enough room, flip.
  const preferred = prefer ?? (spaceBelow >= 200 ? "bottom" : "top")
  const placement = preferred === "bottom" && spaceBelow < 200 && spaceAbove > spaceBelow
    ? "top"
    : preferred === "top" && spaceAbove < 200 && spaceBelow > spaceAbove
    ? "bottom"
    : preferred

  const cardTop = placement === "bottom"
    ? spot.top + spot.height + CARD_GAP
    : spot.top - CARD_GAP - 200 // approximate; card auto-sizes but we anchor bottom via transform below

  // Horizontal: center on target, clamp to viewport
  let cardLeft = spot.left + spot.width / 2 - CARD_WIDTH / 2
  cardLeft = Math.max(VIEWPORT_MARGIN, Math.min(cardLeft, window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN))

  return { spot, card: { top: cardTop, left: cardLeft, placement } }
}

export function CompanyEditTour({ companyId, enabled, steps, namespace = "company_edit.tour", storagePrefix = DEFAULT_STORAGE_PREFIX, onFinish, onStepChange }: CompanyEditTourProps) {
  const t = useTranslations(namespace)
  const storageKey = useMemo(() => `${storagePrefix}${companyId}`, [storagePrefix, companyId])

  const [mounted, setMounted] = useState(false)
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [layout, setLayout] = useState<Layout | null>(null)
  const finishedRef = useRef(false)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish
  const onStepChangeRef = useRef(onStepChange)
  onStepChangeRef.current = onStepChange

  // Notify parent whenever the visible step changes — active toggling,
  // Next/Back, and the finish path all funnel through here.
  useEffect(() => {
    if (!active) {
      onStepChangeRef.current?.(null)
      return
    }
    onStepChangeRef.current?.(stepIndex)
  }, [active, stepIndex])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Kick off the tour once per company. Waits a beat so any auto-opened
  // Services popup can render + settle first — we don't want the tour to
  // paint underneath a modal. When the tour has already been seen for
  // this company we still fire onFinish so the parent can continue the
  // onboarding chain (first-project popup).
  useEffect(() => {
    if (!enabled || !mounted) return
    if (typeof window === "undefined") return
    if (window.localStorage.getItem(storageKey)) {
      if (!finishedRef.current) {
        finishedRef.current = true
        onFinishRef.current?.()
      }
      return
    }
    const timer = setTimeout(() => setActive(true), 400)
    return () => clearTimeout(timer)
  }, [enabled, mounted, storageKey])

  const currentStep = active ? steps[stepIndex] : null

  const findTarget = useCallback((anchor: string) => (
    document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`)
  ), [])

  // Scroll target into view + measure whenever the step (or viewport) changes.
  useLayoutEffect(() => {
    if (!currentStep) { setLayout(null); return }
    const target = findTarget(currentStep.anchor)
    if (!target) { setLayout(null); return }

    // Bring target roughly to the middle of the viewport before measuring
    // so the tooltip doesn't land at a viewport edge on tall pages.
    target.scrollIntoView({ behavior: "smooth", block: "center" })

    // First measure now; then a follow-up after the smooth-scroll has
    // roughly settled.
    setLayout(measure(target, currentStep.placement))
    const settle = window.setTimeout(() => {
      const t2 = findTarget(currentStep.anchor)
      if (t2) setLayout(measure(t2, currentStep.placement))
    }, 350)

    const onResize = () => {
      const el = findTarget(currentStep.anchor)
      if (el) setLayout(measure(el, currentStep.placement))
    }
    window.addEventListener("resize", onResize)
    window.addEventListener("scroll", onResize, true)
    return () => {
      window.clearTimeout(settle)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onResize, true)
    }
  }, [currentStep, findTarget])

  const finish = useCallback(() => {
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(storageKey, "1") } catch {}
    }
    setActive(false)
    setStepIndex(0)
    if (!finishedRef.current) {
      finishedRef.current = true
      onFinishRef.current?.()
    }
  }, [storageKey])

  const next = () => {
    if (stepIndex + 1 >= steps.length) finish()
    else setStepIndex((i) => i + 1)
  }

  const back = () => {
    setStepIndex((i) => Math.max(0, i - 1))
  }

  if (!mounted || !active || !currentStep || !layout) return null

  const isLast = stepIndex + 1 >= steps.length

  const cardStyle: React.CSSProperties = layout.card.placement === "top"
    ? {
        position: "fixed",
        top: layout.spot.top - CARD_GAP,
        left: layout.card.left,
        transform: "translateY(-100%)",
        width: CARD_WIDTH,
      }
    : {
        position: "fixed",
        top: layout.spot.top + layout.spot.height + CARD_GAP,
        left: layout.card.left,
        width: CARD_WIDTH,
      }

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 900, pointerEvents: "none" }}
      aria-hidden={false}
    >
      {/* Dimmed background — full-viewport overlay, then punch a "spotlight"
          hole around the target via a solid box-shadow on a transparent
          box. Avoids needing a mask polyfill. */}
      <div
        onClick={next}
        style={{
          position: "fixed",
          top: layout.spot.top,
          left: layout.spot.left,
          width: layout.spot.width,
          height: layout.spot.height,
          borderRadius: 8,
          boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)",
          outline: "2px solid #016D75",
          outlineOffset: 0,
          transition: "top 200ms ease, left 200ms ease, width 200ms ease, height 200ms ease",
          pointerEvents: "auto",
          cursor: "pointer",
        }}
      />

      {/* Tooltip card */}
      <div
        style={{
          ...cardStyle,
          background: "#fff",
          borderRadius: 8,
          padding: 20,
          boxShadow: "0 20px 48px rgba(15, 23, 42, 0.28)",
          pointerEvents: "auto",
        }}
      >
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#a1a1a0",
            margin: 0,
            marginBottom: 6,
          }}
        >
          {t("step_of", { current: stepIndex + 1, total: steps.length })}
        </p>
        <h4 className="arco-section-title" style={{ margin: 0, marginBottom: 8, fontSize: 24, lineHeight: 1.2 }}>
          {t(currentStep.titleKey)}
        </h4>
        <p className="arco-body-text" style={{ margin: 0, marginBottom: 16, fontSize: 14 }}>
          {t(currentStep.bodyKey)}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button
            type="button"
            onClick={finish}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              fontSize: 13, color: "#a1a1a0", textDecoration: "underline",
              whiteSpace: "nowrap",
            }}
          >
            {t("skip")}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {stepIndex > 0 && (
              <button
                type="button"
                className="btn-tertiary"
                onClick={back}
                style={{ fontSize: 13, padding: "8px 16px", whiteSpace: "nowrap" }}
              >
                {t("back")}
              </button>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={next}
              style={{ fontSize: 13, padding: "8px 18px", whiteSpace: "nowrap" }}
            >
              {isLast ? t("finish") : t("next")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
