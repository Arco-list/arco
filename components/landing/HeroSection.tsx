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
  /** Small text label rendered above the title in the toggle's slot —
   *  same vertical position, but as flat text (no pill background).
   *  Used when the page isn't part of the audience axis but still
   *  wants a mode-of-page hint (e.g. "Photography"). Ignored when
   *  showToggle is true. */
  eyebrow?: string
}

export function HeroSection({ audience, title, body, children, showToggle = true, eyebrow }: HeroSectionProps) {
  return (
    <section className="landing-hero">
      <div className="wrap">
        {showToggle ? (
          <AudienceToggle active={audience} />
        ) : eyebrow ? (
          <p className="landing-hero-eyebrow">{eyebrow}</p>
        ) : null}

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
