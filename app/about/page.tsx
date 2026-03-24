"use client"

// app/about/page.tsx
//
// ── IMAGE SETUP ─────────────────────────────────────────────────────────────
//   Copy your villa photo into your project:
//     cp <your-photo> public/images/about-hero.jpg
//
// ── CSS ──────────────────────────────────────────────────────────────────────
//   Add to globals.css (reveal animation):
//
//   .reveal { opacity: 0; transform: translateY(14px); transition: opacity 0.7s ease, transform 0.7s ease; }
//   .reveal-visible { opacity: 1; transform: none; }
//
// ── DEPENDENCIES ─────────────────────────────────────────────────────────────
//   Classes used from globals.css:
//     .wrap  .arco-eyebrow  .arco-section-title  .arco-h4  .arco-body-text

import { useEffect, useRef, type ReactNode } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

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
  return (
    <section style={{ padding: "96px 0", background: C.white, textAlign: "center" }}>
      <div className="wrap">
        <Reveal><span className="arco-eyebrow" style={{ display: "block", marginBottom: 20 }}>Our mission</span></Reveal>
        <Reveal delay={80}>
          <h2 style={{ ...H, maxWidth: 760, margin: "0 auto" }}>
            Inspiring better architecture through a curated network of architects and professionals worth trusting.
          </h2>
        </Reveal>
      </div>
    </section>
  )
}

const PROOF_ITEMS = [
  { n: "01", title: "Built, not speculative",    body: "Every project on Arco is completed and standing. Editorially reviewed and documented with verified credits for every contributor. No concepts. No pitches. No self-published portfolios." },
  { n: "02", title: "Credited by collaboration", body: "Professionals are credited by the architects who hired them — through real work, delivered together. That endorsement cannot be bought, gamed, or reviewed into existence. It is earned on site, over time." },
  { n: "03", title: "Curation over scale",       body: "Projects are chosen for their architectural merit. Growth is measured by quality, not volume. A smaller collection of extraordinary work is worth more than an endless catalogue of the ordinary." },
]

function ProofOfWork() {
  return (
    <section style={{ padding: "88px 0", background: C.surface }}>
      <div className="wrap">
        <SectionHeader eyebrow="What we are" title="Proof of Work" />
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

const AUDIENCES = [
  { eyebrow: "For architects",   title: "Your work, presented as it deserves to be.",  body: "Arco is a curated platform for built residential architecture. It exists to present architectural work as it should be seen — through completed projects, carefully documented, and properly credited. Architects are at the centre of Arco. Always.",                                                                            img: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=700&q=80", alt: "Architect" },
  { eyebrow: "For professionals", title: "Recognised through the work you deliver.",    body: "Professionals on Arco are credited by the architects who hired them — through real work, delivered together. A presence here is earned through collaboration, not promotion. No open listings. No reviews. No self-published portfolios.",                                                                               img: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=700&q=80", alt: "Interior" },
  { eyebrow: "For clients",       title: "A calmer way to discover architecture.",      body: "Browse by project type, space, or location. See the work first — then discover the professionals behind it. No lead marketplaces. No auctions. Just the work, and the people trusted to do it well.",                                                                                                                    img: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=700&q=80", alt: "House" },
]

function WhoItsFor() {
  return (
    <section style={{ padding: "96px 0", background: C.white }}>
      <div className="wrap">
        <SectionHeader eyebrow="Who it's for" title="Three sides of the same door." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
          {AUDIENCES.map((a, i) => (
            <Reveal key={a.eyebrow} delay={i * 80}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ aspectRatio: "3/4", overflow: "hidden", background: C.surface, marginBottom: 24 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.img} alt={a.alt} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.05)", transition: "transform 7s ease" }} onMouseEnter={e => (e.currentTarget.style.transform = "scale(1)")} onMouseLeave={e => (e.currentTarget.style.transform = "scale(1.05)")} />
                </div>
                <span className="arco-eyebrow" style={{ display: "block", marginBottom: 10 }}>{a.eyebrow}</span>
                <h3 className="arco-h4" style={{ marginBottom: 12 }}>{a.title}</h3>
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
  return (
    <section style={{ padding: "96px 0", background: C.black }}>
      <div className="wrap">
        <Reveal>
          <div style={{ maxWidth: 680 }}>
            <span className="arco-eyebrow" style={{ display: "block", color: "rgba(250,250,249,0.22)", marginBottom: 20 }}>The Arco standard</span>
            <h2 style={{ ...H, color: C.white, marginTop: 16, marginBottom: 20 }}>Not everything belongs here.</h2>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 300, lineHeight: 1.75, color: "rgba(250,250,249,0.38)" }}>
              Arco is intentionally selective. Projects are chosen for their architectural merit. Professionals appear through association, not listings. Growth is measured by quality, not volume. Being published on Arco means something.
            </p>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(20px, 2vw, 28px)", fontWeight: 300, lineHeight: 1.38, letterSpacing: "-0.2px", color: "rgba(250,250,249,0.6)", fontStyle: "italic", marginTop: 40 }}>
              &ldquo;We&apos;re not interested in the average. The world already has plenty of ways to find that. Arco is for the work that makes you stop.&rdquo;
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

const VALUES = [
  { n: "01", name: "Fearless forward",    body: "We move with boldness and purpose. Courage is not the absence of doubt — it is the decision to build anyway." },
  { n: "02", name: "Own the outcome",     body: "We take full responsibility for what we build. When things go wrong, we learn and move — no deflection, no half-measures." },
  { n: "03", name: "Say what matters",    body: "We speak honestly and listen carefully. Titles do not determine whose view counts — the quality of the thinking does." },
  { n: "04", name: "Designed to deliver", body: "Clarity is a form of craft. Strong judgement, precise execution, and attention to detail are not finishing touches — they are the foundation." },
  { n: "05", name: "Rise as a tribe",     body: "We succeed together or not at all. Generous collaboration and shared ownership are what make the work worth doing." },
  { n: "06", name: "Welcome home",        body: "We make space for every voice. Curiosity and respect are not policies — they are how we work, every day." },
]

function OurValues() {
  return (
    <section style={{ padding: "96px 0", background: C.white }}>
      <div className="wrap">
        <SectionHeader eyebrow="Our values" title="How we make decisions." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {VALUES.map((v, i) => (
            <Reveal key={v.n} delay={(i % 3) * 80}>
              <span style={NUM_STYLE}>{v.n}</span>
              <h3 className="arco-h4">{v.name}</h3>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 300, lineHeight: 1.78, color: C.mid, marginTop: 8 }}>{v.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Careers() {
  return (
    <section style={{ padding: "96px 0", background: C.surface }}>
      <div className="wrap">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-start">
          <Reveal>
            <div>
              <span className="arco-eyebrow" style={{ display: "block", marginBottom: 16 }}>Join us</span>
              <h2 style={{ ...H, marginTop: 16, marginBottom: 18 }}>Help build what&apos;s next.</h2>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 300, lineHeight: 1.7, color: C.mid, marginBottom: 40 }}>
                Arco is being built by a small team with a clear purpose. We are looking for people who care about quality — in architecture and in the work they do every day.
              </p>
              <div style={{ background: C.white, border: `1px solid ${C.rule}`, padding: "32px 36px 28px", transition: "border-color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.borderColor = C.mid)} onMouseLeave={e => (e.currentTarget.style.borderColor = C.rule)}>
                <h3 className="arco-h4">Operational Manager</h3>
                <span className="arco-eyebrow" style={{ display: "block", marginTop: 8, marginBottom: 16 }}>Full-time · Remote or Amsterdam</span>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 300, lineHeight: 1.75, color: C.mid, marginBottom: 20 }}>
                  A role for someone who brings structure to ambition — who holds the detail without losing sight of the direction, owns outcomes without ego, and understands that building something lasting requires both vision and discipline.
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
  return (
    <section style={{ padding: "120px 0", background: C.white, textAlign: "center" }}>
      <div className="wrap">
        <Reveal>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(20px, 2.6vw, 36px)", fontWeight: 300, lineHeight: 1.4, letterSpacing: "-0.3px", color: C.black, maxWidth: 820, margin: "0 auto" }}>
            Arco is a curated archive of exceptional architecture projects — giving proper credit to the professionals who realised them, and offering a more deliberate alternative to search, social platforms, and directories.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <>
      <style>{`
        .reveal { opacity: 0; transform: translateY(14px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .reveal-visible { opacity: 1; transform: none; }
      `}</style>

      <Header transparent />

      <main>
        {/* ── Hero ───────────────────────────────────────────────────────────
            IMAGE: copy your villa photo to  public/images/about-hero.jpg
            Then the <img> below will pick it up automatically.
        ─────────────────────────────────────────────────────────────────── */}
        <section style={{ position: "relative", width: "100%", height: "100vh", minHeight: 680, display: "flex", alignItems: "flex-end", overflow: "hidden", background: C.black }}>
          {/* Photo — plain <img> avoids Next.js domain / size config requirements */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/about-hero.jpg"
            alt="Architecture"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 55%" }}
          />

          {/* Hero text — no overlay, sits directly on the photo */}
          <div
            className="relative wrap"
            style={{
              zIndex: 10,
              // clamp gives 64px on small screens, 88px on desktop
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
                Build<br />Beautiful
              </h1>
              {/*
                marginTop creates the gap between headline and subtitle.
                No paddingBottom here — the section's paddingBottom handles
                the gap between the subtitle and the bottom of the viewport.
              */}
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 16,
                  fontWeight: 300,
                  lineHeight: 1.7,
                  color: "rgba(250,250,249,0.52)",
                  maxWidth: "46ch",
                  marginTop: 32,
                }}
              >
                Exceptional architecture projects and the professionals who realised them.
              </p>
            </div>
          </div>
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
