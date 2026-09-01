"use client"

import { Children, useState, type ReactNode } from "react"

/** Collapses a link column behind a "Show all" toggle (JamesEdition-style),
 *  visually matching the project-detail "Read more" affordance. Every item
 *  stays in the DOM (display toggled) so search engines crawl the full
 *  list while visitors see a tidy column. */
export function ShowAllList({ cap, locale, children }: {
  cap: number
  locale: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const items = Children.toArray(children)
  const nl = locale === "nl"
  if (items.length <= cap) return <>{children}</>
  return (
    <>
      {items.slice(0, cap)}
      <div style={{ display: open ? "block" : "none" }}>{items.slice(cap)}</div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="arco-text-link arco-text-link--primary"
        style={{ marginTop: 4 }}
      >
        {/* Same affordance as the FAQ / Read more toggle: a + that
            rotates 45° into an × while open. */}
        <span
          aria-hidden
          style={{
            display: "inline-block",
            fontSize: 16,
            fontWeight: 300,
            lineHeight: 1,
            transition: "transform 0.3s",
            transform: open ? "rotate(45deg)" : "none",
          }}
        >
          +
        </span>
        {/* Labelled so the hover rule lands on the words, not the plus. */}
        <span className="arco-text-link-label">
          {open ? (nl ? "Toon minder" : "Show less") : (nl ? "Toon alles" : "Show all")}
        </span>
      </button>
    </>
  )
}
