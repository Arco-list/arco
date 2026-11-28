import type { ReactNode } from "react"

import { Link } from "@/i18n/navigation"
import { BrandCardLogo } from "@/components/brand/brand-card-logo"
import { focusPositionIn } from "@/lib/images/focus"

/**
 * Een staande merkkaart (2 : 3) voor een QuickRow-carrousel: een beeld van
 * het merk (de hero van een collectie), het logo linksboven, de naam
 * eronder. Op /products en de soortpagina's, en op de bedrijfspagina
 * ("Merken"). Zonder `href` een kaart zonder link.
 */
export function BrandCard({ name, logoUrl, imageUrl, href, focus, size }: {
  name: string; logoUrl: string | null; imageUrl: string | null; href?: string | null
  /** Focuspunt en maat van het beeld: een liggende foto wordt op het product bijgesneden. */
  focus?: { x: number; y: number } | null; size?: { width: number; height: number } | null
}) {
  const body: ReactNode = (
    <>
      <div className="relative w-full overflow-hidden mb-2.5" style={{ aspectRatio: "2/3", background: "var(--arco-surface)" }}>
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.04]" style={focus ? { objectPosition: focusPositionIn(focus, size, 2 / 3) } : undefined} />
        )}
        {logoUrl && (
          <span className="absolute left-4 top-4">
            <BrandCardLogo logoUrl={logoUrl} name={name} />
          </span>
        )}
      </div>
      <span className="arco-card-title" style={{ paddingLeft: 2 }}>{name}</span>
    </>
  )
  return href
    ? <Link href={href} className="quick-row-item group">{body}</Link>
    : <div className="quick-row-item group">{body}</div>
}
