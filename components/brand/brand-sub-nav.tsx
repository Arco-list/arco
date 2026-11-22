"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Link } from "@/i18n/navigation"

/**
 * De subnavigatie van een merkpagina — dezelfde balk, dezelfde klassen
 * en hetzelfde scrollgedrag als ProfessionalSubNav op een bedrijf:
 * Terug links, de secties als eyebrow-links met een streep onder de
 * actieve, acties rechts. Verschillen: de secties zijn die van een merk
 * (Details, Collecties, Projecten, Verkooppunten), en Delen kopieert of
 * deelt de link zelf in plaats van de ShareModal van bedrijven en
 * projecten, want die telt elke deling als een bedrijfs- of
 * projectdeling in de statistieken.
 */

type Section = { id: string; label: string }

type Props = {
  sections: Section[]
  backLabel: string
  shareLabel: string
  copiedLabel: string
  shareTitle: string
  backHref?: string
}

export function BrandSubNav({ sections, backLabel, shareLabel, copiedLabel, shareTitle, backHref = "/brands" }: Props) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "details")
  const [direction, setDirection] = useState<"down" | "up">("down")

  useEffect(() => {
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (y > lastY) setDirection("down")
      else if (y < lastY) setDirection("up")
      lastY = y

      // Actieve sectie: de laatste waarvan de bovenkant in het bovenste derde zit.
      let current = sections[0]?.id ?? "details"
      for (const s of sections) {
        const el = document.getElementById(s.id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top <= window.innerHeight / 3 && rect.bottom >= 0) current = s.id
      }
      setActive(current)
    }
    let timeout: ReturnType<typeof setTimeout>
    const debounced = () => { clearTimeout(timeout); timeout = setTimeout(onScroll, 10) }
    window.addEventListener("scroll", debounced, { passive: true })
    onScroll()
    return () => { window.removeEventListener("scroll", debounced); clearTimeout(timeout) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.map((s) => s.id).join("|")])

  const go = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    if (id === sections[0]?.id) { window.scrollTo({ top: 0, behavior: "smooth" }); return }
    const el = document.getElementById(id)
    if (!el) return
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 140, behavior: "smooth" })
  }

  const share = async () => {
    const url = window.location.href.split("#")[0]
    try {
      if (navigator.share) { await navigator.share({ title: shareTitle, url }); return }
      await navigator.clipboard.writeText(url)
      toast.success(copiedLabel)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      toast.error("Could not share the link")
    }
  }

  return (
    <div className="sub-nav" data-direction={direction}>
      <div className="wrap">
        <div className="sub-nav-content">
          <div className="sub-nav-left">
            <Link href={backHref} className="sub-nav-back">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="sub-nav-back-label">{backLabel}</span>
            </Link>

            <div className="sub-nav-mobile-divider" aria-hidden="true" />

            <div className="sub-nav-links">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={(e) => go(e, s.id)}
                  className={`sub-nav-link arco-eyebrow ${active === s.id ? (direction === "down" ? "active" : "active-reverse") : ""}`}
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          <div className="sub-nav-actions">
            <button className="filter-pill" aria-label={shareLabel} onClick={() => void share()}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 6L11 2L7 2M11 2L5 8M6 3H3C1.89543 3 1 3.89543 1 5V12C1 13.1046 1.89543 14 3 14H10C11.1046 14 12 13.1046 12 12V9" />
              </svg>
              <span className="sub-nav-pill-label">{shareLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
