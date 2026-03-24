import { type ReactNode } from "react"
import { AudienceToggle } from "./AudienceToggle"

interface HeroSectionProps {
  audience: "architects" | "professionals"
  title: string
  body: string
  children: ReactNode
}

export function HeroSection({ audience, title, body, children }: HeroSectionProps) {
  return (
    <section className="landing-hero">
      <div className="wrap">
        <AudienceToggle active={audience} />

        <h1
          className="arco-hero-title"
          style={{ maxWidth: 900, margin: "0 auto 28px" }}
        >
          {title}
        </h1>

        <p className="arco-body-text landing-hero-body">{body}</p>

        <div className="landing-hero-cta">{children}</div>
      </div>
    </section>
  )
}
