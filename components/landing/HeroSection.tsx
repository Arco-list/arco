import { type ReactNode } from "react"
import { AudienceToggle } from "./AudienceToggle"

interface HeroSectionProps {
  audience: "architects" | "professionals"
  title: string
  body: string
  /** Optional CTA area (LinkInputRow, Claim button, etc.). Omit on
   *  pages that don't invite an action — the photography landing is
   *  the first such case. */
  children?: ReactNode
  /** Show the Architects/Professionals segmented toggle above the
   *  title. Defaults to true (matches the /businesses/architects and
   *  /businesses/professionals pages). Set false for landings that
   *  aren't part of that two-audience axis (e.g. photography). */
  showToggle?: boolean
}

export function HeroSection({ audience, title, body, children, showToggle = true }: HeroSectionProps) {
  return (
    <section className="landing-hero">
      <div className="wrap">
        {showToggle && <AudienceToggle active={audience} />}

        <h1
          className="arco-hero-title"
          style={{ maxWidth: 900, margin: "0 auto 28px" }}
        >
          {title}
        </h1>

        <p className="arco-body-text landing-hero-body">{body}</p>

        {children && <div className="landing-hero-cta">{children}</div>}
      </div>
    </section>
  )
}
