"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

const C = {
  white:   "#FAFAF9",
  black:   "#1c1c1a",
  surface: "#f5f5f4",
  mid:     "#6b6b68",
  light:   "#a1a1a0",
  rule:    "#e5e5e4",
  accent:  "#016D75",
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div style={{ borderBottom: `1px solid ${C.rule}` }}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
          padding: "22px 0",
          textAlign: "left",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            fontWeight: 400,
            color: C.black,
            lineHeight: 1.4,
          }}
        >
          {question}
        </span>
        <span
          style={{
            flexShrink: 0,
            width: 16,
            height: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: C.mid,
            transform: isOpen ? "rotate(45deg)" : "none",
            transition: "transform 0.2s ease",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {isOpen && (
        <div style={{ paddingBottom: 24 }}>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: 300,
              lineHeight: 1.78,
              color: C.mid,
              maxWidth: "72ch",
            }}
          >
            {answer}
          </p>
        </div>
      )}
    </div>
  )
}

const Faq12 = () => {
  const t = useTranslations("faq")

  const FAQ_SECTIONS = [
    {
      eyebrow: t("section_browsing_eyebrow"),
      title: t("section_browsing_title"),
      items: [
        { question: t("browsing_q1"), answer: t("browsing_a1") },
        { question: t("browsing_q2"), answer: t("browsing_a2") },
        { question: t("browsing_q3"), answer: t("browsing_a3") },
        { question: t("browsing_q4"), answer: t("browsing_a4") },
      ],
    },
    {
      eyebrow: t("section_architects_eyebrow"),
      title: t("section_architects_title"),
      items: [
        { question: t("architects_q1"), answer: t("architects_a1") },
        { question: t("architects_q2"), answer: t("architects_a2") },
        { question: t("architects_q3"), answer: t("architects_a3") },
        { question: t("architects_q4"), answer: t("architects_a4") },
        { question: t("architects_q5"), answer: t("architects_a5") },
      ],
    },
    {
      eyebrow: t("section_professionals_eyebrow"),
      title: t("section_professionals_title"),
      items: [
        { question: t("professionals_q1"), answer: t("professionals_a1") },
        { question: t("professionals_q2"), answer: t("professionals_a2") },
        { question: t("professionals_q3"), answer: t("professionals_a3") },
        { question: t("professionals_q4"), answer: t("professionals_a4") },
        { question: t("professionals_q5"), answer: t("professionals_a5") },
        { question: t("professionals_q6"), answer: t("professionals_a6") },
      ],
    },
    {
      eyebrow: t("section_account_eyebrow"),
      title: t("section_account_title"),
      items: [
        { question: t("account_q1"), answer: t("account_a1") },
        { question: t("account_q2"), answer: t("account_a2") },
        { question: t("account_q3"), answer: t("account_a3") },
        { question: t("account_q4"), answer: t("account_a4") },
      ],
    },
  ]

  return (
    <>
      {/* Page header */}
      <section style={{ paddingTop: 120, paddingBottom: 64 }}>
        <div className="wrap">
          <span className="arco-eyebrow" style={{ display: "block", marginBottom: 16 }}>
            {t("page_eyebrow")}
          </span>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(32px, 4vw, 56px)",
              fontWeight: 300,
              lineHeight: 1.1,
              letterSpacing: "-0.5px",
              color: C.black,
              maxWidth: 560,
            }}
          >
            {t("page_title")}
          </h1>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              fontWeight: 300,
              lineHeight: 1.7,
              color: C.mid,
              marginTop: 20,
              maxWidth: "48ch",
            }}
          >
            {t("page_description")}
          </p>
        </div>
      </section>

      {/* FAQ sections */}
      {FAQ_SECTIONS.map((section, i) => (
        <section
          key={section.eyebrow}
          style={{ padding: "64px 0" }}
        >
          <div className="wrap">
            <div style={{ maxWidth: 760 }}>
              <div style={{ marginBottom: 36 }}>
                <span className="arco-eyebrow" style={{ display: "block", marginBottom: 12 }}>
                  {section.eyebrow}
                </span>
                <h2
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "clamp(20px, 2.4vw, 32px)",
                    fontWeight: 300,
                    lineHeight: 1.2,
                    letterSpacing: "-0.3px",
                    color: C.black,
                  }}
                >
                  {section.title}
                </h2>
              </div>
              <div style={{ borderTop: `1px solid ${C.rule}` }}>
                {section.items.map((item) => (
                  <FAQItem key={item.question} question={item.question} answer={item.answer} />
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* Contact CTA */}
      <section style={{ padding: "96px 0", background: C.surface, textAlign: "center" }}>
        <div className="wrap">
          <span
            className="arco-eyebrow"
            style={{ display: "block", marginBottom: 16 }}
          >
            {t("still_have_questions")}
          </span>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(24px, 3vw, 44px)",
              fontWeight: 300,
              lineHeight: 1.1,
              letterSpacing: "-0.4px",
              color: C.black,
              marginBottom: 20,
            }}
          >
            {t("here_to_help")}
          </h2>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              fontWeight: 300,
              lineHeight: 1.7,
              color: C.mid,
              maxWidth: "44ch",
              margin: "0 auto 40px",
            }}
          >
            {t("contact_description")}
          </p>
          <a
            href="mailto:hello@arcolist.com"
            style={{
              display: "inline-block",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: C.white,
              background: C.black,
              padding: "14px 32px",
              textDecoration: "none",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            hello@arcolist.com
          </a>
        </div>
      </section>
    </>
  )
}

export { Faq12 }
