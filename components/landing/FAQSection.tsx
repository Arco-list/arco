"use client"

import { useState } from "react"

export interface FAQItem {
  question: string
  answer: string
}

interface FAQSectionProps {
  items: FAQItem[]
  /** Optional override for top padding, e.g. 60 when placed close to endorsement carousel */
  paddingTop?: number
  /** Optional override for bottom padding (default 100 from .faq-section). */
  paddingBottom?: number
  heading?: string
  /** "left" skips the centered header/list (used by the discover outros,
   *  which align to the left-aligned hub directory above them). */
  align?: "center" | "left"
}

export function FAQSection({ items, paddingTop, paddingBottom, heading = "Frequently asked questions", align = "center" }: FAQSectionProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const toggle = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index)
  }

  return (
    <section
      className="faq-section"
      style={
        paddingTop !== undefined || paddingBottom !== undefined
          ? { ...(paddingTop !== undefined ? { paddingTop } : {}), ...(paddingBottom !== undefined ? { paddingBottom } : {}) }
          : undefined
      }
    >
      <div className="wrap">
        <div className="faq-header" style={align === "left" ? { textAlign: "left", marginBottom: 32 } : undefined}>
          {align === "left"
            ? <h2 className="arco-subsection-title">{heading}</h2>
            : <h2 className="arco-section-title">{heading}</h2>}
        </div>
        <div className="faq-list" style={align === "left" ? { margin: 0, maxWidth: 760 } : undefined}>
          {items.map((item, i) => (
            <div
              key={item.question}
              className={`faq-item${activeIndex === i ? " active" : ""}`}
            >
              <div className="faq-question" onClick={() => toggle(i)}>
                <span className="faq-question-text">{item.question}</span>
                <span className="faq-toggle">+</span>
              </div>
              <div className="faq-answer">
                <div className="faq-answer-inner arco-body-text">
                  {item.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
