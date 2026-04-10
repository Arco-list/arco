"use client"

// app/[locale]/about/about-client.tsx
//
// The hero image + credit line are passed in from the server page, which
// fetches a featured project from Supabase. Falls back to
// /images/about-hero.jpg if no featured project is available.
//
// ── CSS ──────────────────────────────────────────────────────────────────────
//   Add to globals.css (reveal animation):
//
//   .reveal { opacity: 0; transform: translateY(14px); transition: opacity 0.7s ease, transform 0.7s ease; }
//   .reveal-visible { opacity: 1; transform: none; }
//
// ── DEPENDENCIES ─────────────────────────────────────────────────────────────
//   Classes used from globals.css:
//     .wrap  .arco-eyebrow  .arco-section-title  .arco-label  .arco-body-text

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import { Settings2 } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { HeroCoversEditor } from "@/components/hero-covers-editor"

// ─── Tokens (match globals.css vars) ─────────────────────────────────────────
const C = {
  white:   "#FAFAF9",
  black:   "#1c1c1a",
  surface: "#f5f5f4",
  mid:     "#6b6b68",
  light:   "#a1a1a0",
  rule:    "#e5e5e4",
  accent:  "#016D75",
}

// ─── Shared heading style ─────────────────────────────────────────────────────
const H: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: "clamp(24px, 2.8vw, 42px)",
  fontWeight: 300,
  letterSpacing: "-0.4px",
  lineHeight: 1.15,
  color: C.black,
}

// ─── Scroll reveal ────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.style.transitionDelay = `${delay}ms`; el.classList.add("reveal-visible"); io.unobserve(el) } },
      { threshold: 0.07 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [delay])
  return <div ref={ref} className={`reveal ${className}`}>{children}</div>
}

// ─── Section header block (eyebrow + title) ───────────────────────────────────
function SectionHeader({ eyebrow, title, light = false }: { eyebrow: string; title: string; light?: boolean }) {
  return (
    <div style={{ marginBottom: 52 }}>
      <Reveal>
        <span
          className="arco-eyebrow"
          style={{ display: "block", marginBottom: 16, ...(light ? { color: "rgba(250,250,249,0.22)" } : {}) }}
        >
          {eyebrow}
        </span>
      </Reveal>
      <Reveal delay={80}>
        <h2 style={{ ...H, marginTop: 16, ...(light ? { color: C.white } : {}) }}>{title}</h2>
      </Reveal>
    </div>
  )
}

// ─── Number — serif, 36px, matches features-section ──────────────────────────
// Defined inline so it works regardless of whether .how-number is in globals.css
const NUM_STYLE: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-serif)",
  fontSize: 36,
  fontWeight: 300,
  lineHeight: 1,
  color: C.mid,
  marginBottom: 20,   // ← explicit gap between number and title
}

// ─── SECTIONS ─────────────────────────────────────────────────────────────────

function Mission() {
  const t = useTranslations("about")
  return (
    <section style={{ padding: "96px 0", background: C.white, textAlign: "center" }}>
      <div className="wrap">
        <Reveal><span className="arco-eyebrow" style={{ display: "block", marginBottom: 20 }}>{t("mission_eyebrow")}</span></Reveal>
        <Reveal delay={80}>
          <h2 style={{ ...H, maxWidth: 760, margin: "0 auto" }}>
            {t("mission_title")}
          </h2>
        </Reveal>
      </div>
    </section>
  )
}

function ProofOfWork() {
  const t = useTranslations("about")
  const PROOF_ITEMS = [
    { n: "01", title: t("proof_1_title"), body: t("proof_1_body") },
    { n: "02", title: t("proof_2_title"), body: t("proof_2_body") },
    { n: "03", title: t("proof_3_title"), body: t("proof_3_body") },
  ]

  return (
    <section style={{ padding: "88px 0", background: C.surface }}>
      <div className="wrap">
        <SectionHeader eyebrow={t("proof_eyebrow")} title={t("proof_title")} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {PROOF_ITEMS.map((item, i) => (
            <Reveal key={item.n} delay={i * 80}>
              <span style={NUM_STYLE}>{item.n}</span>
              <h3 style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 500, color: C.black, marginBottom: 10, lineHeight: 1.3 }}>{item.title}</h3>
              <p  style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 300, color: C.mid,   lineHeight: 1.75 }}>{item.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function WhoItsFor() {
  const t = useTranslations("about")
  const AUDIENCES = [
    { eyebrow: t("for_architects_eyebrow"), title: t("for_architects_title"), body: t("for_architects_body"), img: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=700&q=80", alt: "Architect" },
    { eyebrow: t("for_professionals_eyebrow"), title: t("for_professionals_title"), body: t("for_professionals_body"), img: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=700&q=80", alt: "Interior" },
    { eyebrow: t("for_clients_eyebrow"), title: t("for_clients_title"), body: t("for_clients_body"), img: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=700&q=80", alt: "House" },
  ]

  return (
    <section style={{ padding: "96px 0", background: C.white }}>
      <div className="wrap">
        <SectionHeader eyebrow={t("audience_eyebrow")} title={t("audience_title")} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
          {AUDIENCES.map((a, i) => (
            <Reveal key={a.eyebrow} delay={i * 80}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ aspectRatio: "3/4", overflow: "hidden", background: C.surface, marginBottom: 24 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.img} alt={a.alt} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.05)", transition: "transform 7s ease" }} onMouseEnter={e => (e.currentTarget.style.transform = "scale(1)")} onMouseLeave={e => (e.currentTarget.style.transform = "scale(1.05)")} />
                </div>
                <span className="arco-eyebrow" style={{ display: "block", marginBottom: 10 }}>{a.eyebrow}</span>
                <h3 className="arco-label" style={{ marginBottom: 12 }}>{a.title}</h3>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 300, lineHeight: 1.78, color: C.mid }}>{a.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function ArcoStandard() {
  const t = useTranslations("about")
  return (
    <section style={{ padding: "96px 0", background: C.black }}>
      <div className="wrap">
        <Reveal>
          <div style={{ maxWidth: 680 }}>
            <span className="arco-eyebrow" style={{ display: "block", color: "rgba(250,250,249,0.22)", marginBottom: 20 }}>{t("standard_eyebrow")}</span>
            <h2 style={{ ...H, color: C.white, marginTop: 16, marginBottom: 20 }}>{t("standard_title")}</h2>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 300, lineHeight: 1.75, color: "rgba(250,250,249,0.38)" }}>
              {t("standard_body")}
            </p>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(20px, 2vw, 28px)", fontWeight: 300, lineHeight: 1.38, letterSpacing: "-0.2px", color: "rgba(250,250,249,0.6)", fontStyle: "italic", marginTop: 40 }}>
              &ldquo;{t("standard_quote")}&rdquo;
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function OurValues() {
  const t = useTranslations("about")
  const VALUES = [
    { n: "01", name: t("value_1_name"), body: t("value_1_body") },
    { n: "02", name: t("value_2_name"), body: t("value_2_body") },
    { n: "03", name: t("value_3_name"), body: t("value_3_body") },
    { n: "04", name: t("value_4_name"), body: t("value_4_body") },
    { n: "05", name: t("value_5_name"), body: t("value_5_body") },
    { n: "06", name: t("value_6_name"), body: t("value_6_body") },
  ]

  return (
    <section style={{ padding: "96px 0", background: C.white }}>
      <div className="wrap">
        <SectionHeader eyebrow={t("values_eyebrow")} title={t("values_title")} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {VALUES.map((v, i) => (
            <Reveal key={v.n} delay={(i % 3) * 80}>
              <span style={NUM_STYLE}>{v.n}</span>
              <h3 className="arco-label">{v.name}</h3>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 300, lineHeight: 1.78, color: C.mid, marginTop: 8 }}>{v.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Careers() {
  const t = useTranslations("about")
  return (
    <section style={{ padding: "96px 0", background: C.surface }}>
      <div className="wrap">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-start">
          <Reveal>
            <div>
              <span className="arco-eyebrow" style={{ display: "block", marginBottom: 16 }}>{t("careers_eyebrow")}</span>
              <h2 style={{ ...H, marginTop: 16, marginBottom: 18 }}>{t("careers_title")}</h2>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 300, lineHeight: 1.7, color: C.mid, marginBottom: 40 }}>
                {t("careers_body")}
              </p>
              <div style={{ background: C.white, border: `1px solid ${C.rule}`, padding: "32px 36px 28px", transition: "border-color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.borderColor = C.mid)} onMouseLeave={e => (e.currentTarget.style.borderColor = C.rule)}>
                <h3 className="arco-label">{t("careers_role_title")}</h3>
                <span className="arco-eyebrow" style={{ display: "block", marginTop: 8, marginBottom: 16 }}>{t("careers_role_location")}</span>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 300, lineHeight: 1.75, color: C.mid, marginBottom: 20 }}>
                  {t("careers_role_body")}
                </p>
                <a href="mailto:hello@arcolist.com" style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: C.accent, textDecoration: "none" }}>hello@arcolist.com</a>
              </div>
            </div>
          </Reveal>

          <Reveal delay={160} className="hidden md:block">
            <div style={{ aspectRatio: "4/3", overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80" alt="Architecture" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function Closing() {
  const t = useTranslations("about")
  return (
    <section style={{ padding: "120px 0", background: C.white, textAlign: "center" }}>
      <div className="wrap">
        <Reveal>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(20px, 2.6vw, 36px)", fontWeight: 300, lineHeight: 1.4, letterSpacing: "-0.3px", color: C.black, maxWidth: 820, margin: "0 auto" }}>
            {t("closing_body")}
          </p>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export type AboutHeroCover = {
  image: string
  title: string
  projectSlug: string | null
  companyName: string | null
  companySlug: string | null
}

interface AboutClientProps {
  covers: AboutHeroCover[]
  isSuperAdmin?: boolean
}

export function AboutClient({ covers, isSuperAdmin = false }: AboutClientProps) {
  const t = useTranslations("about")
  // SSR-stable: start with first cover, then pick a random one on mount so
  // each page load surfaces a different project without breaking hydration.
  const [activeIndex, setActiveIndex] = useState(0)
  const [showEditor, setShowEditor] = useState(false)
  useEffect(() => {
    if (covers.length <= 1) return
    setActiveIndex(Math.floor(Math.random() * covers.length))
  }, [covers.length])

  const active = covers[activeIndex] ?? covers[0]
  const heroImage = active?.image ?? "/images/about-hero.jpg"
  const hasCredit = Boolean(active?.title || active?.companyName)

  return (
    <>
      <style>{`
        .reveal { opacity: 0; transform: translateY(14px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .reveal-visible { opacity: 1; transform: none; }
      `}</style>

      <Header transparent />

      <main>
        {/* ── Hero ───────────────────────────────────────────────────────────
            Image + credit come from the server page, which picks a featured
            project from Supabase. Falls back to /images/about-hero.jpg.
        ─────────────────────────────────────────────────────────────────── */}
        <section style={{ position: "relative", width: "100%", height: "100vh", minHeight: 680, display: "flex", alignItems: "flex-end", overflow: "hidden", background: C.black }}>
          {/* Photo — plain <img> avoids Next.js domain / size config requirements */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            alt={active?.title || "Architecture"}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 55%" }}
          />

          {/* Subtle bottom gradient so text stays readable over any photo */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)",
              pointerEvents: "none",
            }}
          />

          {/* Hero text — sits over the gradient */}
          <div
            className="relative wrap"
            style={{
              zIndex: 10,
              paddingBottom: "clamp(64px, 8vh, 88px)",
            }}
          >
            <div style={{ maxWidth: 900 }}>
              <h1
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "clamp(56px, 8.5vw, 120px)",
                  fontWeight: 300,
                  lineHeight: 0.9,
                  letterSpacing: "-2.5px",
                  color: C.white,
                }}
              >
                {t("hero_line1")}<br />{t("hero_line2")}
              </h1>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 16,
                  fontWeight: 300,
                  lineHeight: 1.7,
                  color: "rgba(250,250,249,0.72)",
                  maxWidth: "46ch",
                  marginTop: 32,
                }}
              >
                {t("hero_subtitle")}
              </p>
            </div>
          </div>

          {/* Credit line — bottom-right, uses the same arco-eyebrow style as
              the homepage hero so both surfaces share one typographic voice. */}
          {hasCredit && (
            <div
              style={{
                position: "absolute",
                right: "clamp(20px, 4vw, 48px)",
                bottom: "clamp(24px, 4vh, 40px)",
                zIndex: 10,
                textAlign: "right",
                lineHeight: 1.6,
              }}
            >
              {active.title && (
                active.projectSlug ? (
                  <a
                    href={`/projects/${active.projectSlug}`}
                    className="arco-eyebrow"
                    style={{ color: "white", display: "block", textDecoration: "none" }}
                  >
                    {active.title}
                  </a>
                ) : (
                  <span className="arco-eyebrow" style={{ color: "white", display: "block" }}>
                    {active.title}
                  </span>
                )
              )}
              {active.companyName && (
                active.companySlug ? (
                  <a
                    href={`/professionals/${active.companySlug}`}
                    className="arco-eyebrow"
                    style={{ color: "rgba(250,250,249,0.7)", display: "block", textDecoration: "none", marginTop: 2 }}
                  >
                    {active.companyName}
                  </a>
                ) : (
                  <span className="arco-eyebrow" style={{ color: "rgba(250,250,249,0.7)", display: "block", marginTop: 2 }}>
                    {active.companyName}
                  </span>
                )
              )}
            </div>
          )}

          {/* Super admin: edit /about hero covers */}
          {isSuperAdmin && (
            <>
              <button
                type="button"
                onClick={() => setShowEditor(true)}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 50,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "white",
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 20,
                  cursor: "pointer",
                  backdropFilter: "blur(4px)",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.7)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.5)")}
              >
                <Settings2 style={{ width: 14, height: 14 }} />
                Select covers
              </button>
              <HeroCoversEditor
                isOpen={showEditor}
                onClose={() => setShowEditor(false)}
                scope="about"
              />
            </>
          )}
        </section>

        <Mission />
        <ProofOfWork />
        <WhoItsFor />
        <ArcoStandard />
        <OurValues />
        <Careers />
        <Closing />
      </main>

      <Footer />
    </>
  )
}
