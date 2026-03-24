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
}

export function FAQSection({ items, paddingTop }: FAQSectionProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const toggle = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index)
  }

  return (
    <section
      className="faq-section"
      style={paddingTop !== undefined ? { paddingTop } : undefined}
    >
      <div className="wrap">
        <div className="faq-header">
          <h2 className="arco-section-title">Frequently Asked Questions</h2>
        </div>
        <div className="faq-list">
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
