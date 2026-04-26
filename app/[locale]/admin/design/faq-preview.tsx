"use client"

import { useState } from "react"

const FAQ_ITEMS = [
  {
    question: "Is Arco really free for architects?",
    answer:
      "Yes, completely. We charge service providers who want to connect with our architect network, which keeps the platform free for you. Architects never pay to publish or participate.",
  },
  {
    question: "How selective is the application process?",
    answer:
      "We review every submission carefully, looking for thoughtful design, quality execution, and professional presentation. About 60% of applications are accepted.",
  },
  {
    question: "Can I invite my preferred contractors and professionals?",
    answer:
      "Absolutely. You can invite trusted builders, interior designers, engineers, and other professionals. When you credit them on a project, that endorsement carries real weight.",
  },
  {
    question: "How do clients find me on Arco?",
    answer:
      "Clients browse projects by style, location, and type. When they find work that resonates, they reach out directly through the platform — no bidding required.",
  },
  {
    question: "What kind of projects should I submit?",
    answer:
      "Submit your best work — completed, professionally photographed, and based in the Netherlands. You can showcase international work once accepted.",
  },
]

export function FAQPreview() {
  const [active, setActive] = useState<number | null>(4)
  return (
    <div className="faq-list" style={{ maxWidth: "none" }}>
      {FAQ_ITEMS.map((item, i) => (
        <div key={item.question} className={`faq-item${active === i ? " active" : ""}`}>
          <div className="faq-question" onClick={() => setActive(active === i ? null : i)}>
            <span className="faq-question-text">{item.question}</span>
            <span className="faq-toggle">+</span>
          </div>
          <div className="faq-answer">
            <div className="faq-answer-inner arco-body-text">{item.answer}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
