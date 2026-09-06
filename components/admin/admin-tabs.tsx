"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * URL-backed tab row for admin pages — the second nav layer under the
 * page title, styled after the project sub-nav (uppercase eyebrow
 * labels, hairline underline on the active tab).
 *
 * The active tab lives in the querystring (?tab=…), so refresh, the
 * back button and shared links all land on the same view — the same
 * "pages, not pop-ups" argument as the claim funnel. The FIRST tab is
 * the default and keeps the URL clean (no ?tab= param); `useAdminTab`
 * applies the same rule when reading, so the two always agree.
 *
 * Deliberately a per-page component, not a fixed bar in the admin
 * layout: only pages that have tabs render it, so there is never an
 * empty second nav.
 */
export type AdminTabDef = { key: string; label: string; badge?: number }

export function useAdminTab<T extends string>(keys: readonly T[], fallback?: T, param = "tab"): T {
  const searchParams = useSearchParams()
  const v = searchParams.get(param) as T | null
  if (v && keys.includes(v)) return v
  return fallback ?? keys[0]
}

export function AdminTabs({
  tabs,
  active,
  param = "tab",
  onChange,
  actions,
  left,
  title,
}: {
  /** Omit for toolbar mode: a tabless sticky bar carrying only `left`
   *  and `actions` (e.g. Sales: search + filters, no views). */
  tabs?: AdminTabDef[]
  active?: string
  param?: string
  onChange?: (key: string) => void
  /** Right side of the bar: filters, status buttons — page-level controls
   *  that should stay reachable while the sticky bar is pinned. */
  actions?: React.ReactNode
  /** Left side of the bar, before (or instead of) the tabs — e.g. a
   *  search input in toolbar mode. */
  left?: React.ReactNode
  /** Page title, leftmost in the bar with a divider — replaces the big
   *  in-content heading so the sticky bar always says where you are. */
  title?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const select = (key: string) => {
    if (key === active) return
    const next = new URLSearchParams(searchParams.toString())
    if (key === tabs?.[0]?.key) next.delete(param)
    else next.set(param, key)
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    onChange?.(key)
  }

  // Rides the project sub-nav's CSS machinery wholesale (.sub-nav:
  // sticky under the site header, white ground, hairline bottom rule;
  // .sub-nav-link.active: the animated underline). Render it OUTSIDE
  // the page's .wrap — the bar is full-bleed and brings its own.
  return (
    <div className="sub-nav">
      {/* Horizontally scrollable on small screens: min-width max-content
          lets the row lay out on one line and overflow into the scroll;
          on wide screens the row fits and justify-between still pushes
          the actions to the right edge. Dropdowns portal to <body>, so
          the overflow never clips them. */}
      <div className="wrap overflow-x-auto scrollbar-hide">
        <div className="sub-nav-content" style={{ minWidth: "max-content", columnGap: 24 }}>
          <div className="sub-nav-links" style={{ alignItems: "center", paddingRight: actions ? undefined : 0, marginRight: actions ? undefined : 0 }}>
            {title && (
              <span
                className="shrink-0"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--arco-black)",
                  paddingRight: 24,
                  // Divider only when something follows the title —
                  // a title-only bar (e.g. Brands) needs no rule.
                  borderRight: (tabs?.length || left) ? "1px solid var(--arco-rule)" : "none",
                  // Full-height divider, like .sub-nav-back on the
                  // project sub-nav: stretch to the bar's height and
                  // center the text inside. The links row's own gap
                  // (32px) provides the space to the first tab.
                  alignSelf: "stretch",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {title}
              </span>
            )}
            {(tabs ?? []).map((t) => {
              const isActive = t.key === active
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => select(t.key)}
                  className={`sub-nav-link arco-eyebrow${isActive ? " active" : ""}`}
                  // The .sub-nav-link.active::after underline hangs 1px BELOW
                  // the link, and the scrollable wrap (overflow-x: auto forces
                  // vertical clipping too) cuts exactly that pixel off. Draw
                  // the active underline as an inset shadow instead — inside
                  // the clip, visually on the bar's bottom rule.
                  style={isActive ? { boxShadow: "inset 0 -1px 0 0 var(--arco-black)" } : undefined}
                >
                  <span className="flex items-center gap-1.5">
                    {t.label}
                    {typeof t.badge === "number" && t.badge > 0 && (
                      <span
                        className="inline-flex items-center justify-center text-[10px] font-medium px-1.5 rounded-full"
                        style={{ background: "#016D75", color: "#fff", minWidth: 16, height: 16, letterSpacing: 0 }}
                      >
                        {t.badge}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
            {left}
          </div>
          {actions && <div className="sub-nav-actions">{actions}</div>}
        </div>
      </div>
    </div>
  )
}
