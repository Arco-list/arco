"use client"

import { useEffect, useRef, useState } from "react"
import { Link } from "@/i18n/navigation"

export type BreadcrumbSelectItem =
  /** Crawlable link option (sibling hubs / next-level choices). */
  | { label: string; href: string; suffix?: string }
  /** Filter toggle option — checkbox semantics, dropdown stays open so
   *  multiple can be (de)selected; the filter write-back handles the URL. */
  | { label: string; checked: boolean; onToggle: () => void; suffix?: string }

/** JamesEdition-style interactive breadcrumb segment: renders as a crumb
 *  with a chevron; clicking opens a dropdown of links or filter toggles.
 *  Link options are plain anchors in the DOM, so the lateral hub mesh
 *  stays crawlable. */
export function BreadcrumbSelect({ label, items, muted = false }: {
  label: string
  items: BreadcrumbSelectItem[]
  /** Placeholder styling ("Kies locatie") vs. an actual selection. */
  muted?: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  if (items.length === 0) {
    return <span className="discover-breadcrumb-item discover-breadcrumb-current">{label}</span>
  }

  const suffixEl = (suffix?: string) =>
    suffix ? (
      <span style={{ marginLeft: "auto", paddingLeft: 16, fontSize: 11, color: "#a1a1a0", flexShrink: 0 }}>
        {suffix}
      </span>
    ) : null

  return (
    <span ref={wrapRef} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="discover-breadcrumb-item"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: muted ? "#c4c4c2" : undefined,
        }}
      >
        {label}
        <svg
          width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"
          style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 200,
            background: "#fff",
            border: "1px solid var(--arco-rule)",
            borderRadius: 8,
            boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
            padding: "8px 0",
            minWidth: 240,
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {items.map((item) =>
            "href" in item ? (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="text-[13px] text-[#1c1c1a] hover:bg-[#fafaf9] transition-colors"
                style={{ padding: "7px 16px", textDecoration: "none", textTransform: "none", letterSpacing: "normal", display: "flex", alignItems: "center", whiteSpace: "nowrap" }}
              >
                {item.label}
                {suffixEl(item.suffix)}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                onClick={item.onToggle}
                aria-pressed={item.checked}
                className="text-[13px] text-[#1c1c1a] hover:bg-[#fafaf9] transition-colors"
                style={{
                  padding: "7px 16px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textTransform: "none",
                  letterSpacing: "normal",
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  textAlign: "left",
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 15,
                    height: 15,
                    marginRight: 10,
                    borderRadius: 4,
                    border: item.checked ? "none" : "1px solid #d4d4d2",
                    background: item.checked ? "var(--arco-black)" : "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {item.checked && (
                    <svg width="9" height="9" viewBox="0 0 10 10">
                      <path d="M1.5 5.5L4 8L8.5 2.5" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {item.label}
                {suffixEl(item.suffix)}
              </button>
            ),
          )}
        </div>
      )}
    </span>
  )
}
