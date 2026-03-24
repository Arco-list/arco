"use client"

import { useState } from "react"

const C = {
  white:   "#FAFAF9",
  black:   "#1c1c1a",
  surface: "#f5f5f4",
  mid:     "#6b6b68",
  light:   "#a1a1a0",
  rule:    "#e5e5e4",
  accent:  "#016D75",
}

const FAQ_SECTIONS = [
  {
    eyebrow: "Browsing Arco",
    title: "Discovering projects & professionals",
    items: [
      {
        question: "What can I find on Arco?",
        answer: "Arco is a curated archive of completed residential architecture projects. Every project is verified, documented, and properly credited to the architects and professionals who made it. You will not find concepts, renders, or self-published portfolios here.",
      },
      {
        question: "How do I search for specific types of projects?",
        answer: "Use the filter bar on the Projects page to narrow by project type, architectural style, location, and size. You can also browse by featured collections such as villas, kitchens, outdoor spaces, and new builds.",
      },
      {
        question: "Can I save projects and professionals I like?",
        answer: "Yes. Create a free account and save any project or professional to your collection. Access your saved items at any time from your account dashboard.",
      },
      {
        question: "Is Arco free to browse?",
        answer: "Browsing is always free. There is no paywall to explore projects or discover professionals. An account is only required to save items or get in touch with a professional.",
      },
    ],
  },
  {
    eyebrow: "For architects",
    title: "Publishing your work",
    items: [
      {
        question: "How do I publish a project on Arco?",
        answer: "Projects are published through an architect account. Sign up, create your company profile, and submit your project from the dashboard. Our editorial team reviews all submissions before they go live.",
      },
      {
        question: "What makes a project eligible for Arco?",
        answer: "Projects must be completed residential architecture — built and standing. We look for work with clear architectural intent, quality documentation, and verified credits. Speculative designs, renders, and unbuilt concepts are not accepted.",
      },
      {
        question: "How do I credit the professionals who worked on my project?",
        answer: "During the project upload, you can invite contractors, interior designers, and other collaborators by email. Once they accept, they are credited on the project and it appears in their professional profile automatically.",
      },
      {
        question: "Can I control who sees my projects?",
        answer: "Projects remain private as drafts until you choose to publish them. Published projects are visible to everyone. You can unpublish a project at any time from your dashboard.",
      },
    ],
  },
  {
    eyebrow: "For professionals",
    title: "Being credited through your work",
    items: [
      {
        question: "How do I appear on Arco as a professional?",
        answer: "Professionals appear on Arco by being credited on a published project by the architect who hired them. There are no self-published listings — your presence is earned through verified collaboration.",
      },
      {
        question: "Can I create my own profile without being credited?",
        answer: "You can create a company account and complete your profile, but your work will only appear publicly once an architect credits you on a project. This is by design — quality is earned, not claimed.",
      },
      {
        question: "What does it mean to be credited on a project?",
        answer: "It means the architect who hired you has acknowledged your contribution to a real, completed project. That endorsement is public, permanent, and directly associated with the finished work.",
      },
      {
        question: "How do I join my company's account on Arco?",
        answer: "Ask your company administrator to invite you by email from the company dashboard. You will receive an invitation link to join the team.",
      },
    ],
  },
  {
    eyebrow: "Account & billing",
    title: "Managing your account",
    items: [
      {
        question: "How do I create an account?",
        answer: "Click Log in at the top of any page and sign up with your email address. During registration you will be asked to select your account type — client, architect, or professional.",
      },
      {
        question: "What subscription plans are available?",
        answer: "Arco offers plans for architects and professionals who want to publish and manage their work. Visit the Pricing page for current options and features. Browsing is always free.",
      },
      {
        question: "How do I update my company profile?",
        answer: "From your dashboard, navigate to Company settings. You can update your company name, description, services, and profile photo at any time.",
      },
      {
        question: "How do I get in touch if something isn't working?",
        answer: "Send an email to hello@arcolist.com and we will get back to you as quickly as possible. For billing questions, include your account email so we can locate your account.",
      },
    ],
  },
]

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
  return (
    <>
      {/* Page header */}
      <section style={{ paddingTop: 120, paddingBottom: 64 }}>
        <div className="wrap">
          <span className="arco-eyebrow" style={{ display: "block", marginBottom: 16 }}>
            Help & FAQ
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
            Questions answered.
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
            Everything you need to know about browsing, publishing, and managing your account on Arco.
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
            Still have questions?
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
            We&apos;re here to help.
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
            If you didn&apos;t find what you were looking for, send us a message and we&apos;ll get back to you.
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
