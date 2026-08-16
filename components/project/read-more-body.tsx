"use client"

import { useState } from "react"

/** Expanded editorial body behind a "Read more" toggle. The content is
 *  always in the DOM (display toggled), so search engines index it in
 *  full while the default view keeps the photography-first layout —
 *  visitors who want the narrative opt in with one click. */
export function ReadMoreBody({ paragraphs, moreLabel, lessLabel }: {
  paragraphs: string[]
  moreLabel: string
  lessLabel: string
}) {
  const [open, setOpen] = useState(false)
  if (paragraphs.length === 0) return null
  return (
    <>
      <div style={{ display: open ? "block" : "none" }}>
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="arco-body-text">
            {paragraph}
          </p>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-[13px] text-[#016D75] hover:text-[#014f55] transition-colors bg-transparent border-none cursor-pointer p-0"
        style={{ marginTop: 4 }}
      >
        {open ? lessLabel : moreLabel}
      </button>
    </>
  )
}
