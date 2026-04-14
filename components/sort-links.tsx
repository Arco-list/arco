"use client"

import { useRef, useState, useEffect } from "react"
import { useTranslations } from "next-intl"

const SORT_LABEL_KEYS: Record<string, string> = {
  // Project sort keys (lib/projects/sort.ts)
  most_relevant: "sort_most_relevant",
  featured: "sort_featured",
  popular: "sort_most_popular",
  most_recent: "sort_most_recent",
  // Legacy/other-namespace labels still used by companies/professionals sort
  "Most recent": "sort_most_recent",
  "Most liked": "sort_most_liked",
  "Most popular": "sort_most_popular",
  "Alphabetical": "sort_alphabetical",
  "Best match": "sort_best_match",
  "Highest rated": "sort_highest_rated",
}

interface SortLinksProps<T extends string> {
  options: readonly T[]
  current: T
  onChange: (value: T) => void
  namespace?: string
}

export function SortLinks<T extends string>({ options, current, onChange, namespace = "projects" }: SortLinksProps<T>) {
  const t = useTranslations(namespace)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const currentLabel = SORT_LABEL_KEYS[current] ? t(SORT_LABEL_KEYS[current]) : current

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 300,
          color: "var(--arco-mid-grey)",
          fontFamily: "var(--font-sans)",
          display: "flex",
          alignItems: "center",
          gap: 4,
          whiteSpace: "nowrap",
        }}
      >
        {currentLabel}
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          right: 0,
          background: "white",
          border: "1px solid var(--arco-rule)",
          borderRadius: 6,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          minWidth: 160,
          padding: "4px 0",
          zIndex: 50,
        }}>
          {options.map((opt) => {
            const labelKey = SORT_LABEL_KEYS[opt]
            const label = labelKey ? t(labelKey) : opt
            const isActive = opt === current

            return (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false) }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: isActive ? 500 : 300,
                  color: isActive ? "var(--arco-black)" : "var(--arco-mid-grey)",
                  fontFamily: "var(--font-sans)",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--arco-off-white)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
