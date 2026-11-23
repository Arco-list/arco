"use client"

import { Link } from "@/i18n/navigation"
import { LogoFill } from "@/components/brand/brand-logo"
import { resolveProfessionalServiceIcon } from "@/lib/icons/professional-services"
import type { CatalogDealer } from "@/lib/products/catalog-types"

/**
 * Verkooppunten op de merkpagina, in dezelfde kaart als de vermelde
 * professionals op een project: categorie als eyebrow, logo op de grijze
 * schijf (zonder logo het icoon van de dienst), naam en eronder de plaats.
 * Client component: de iconenkaart (resolveProfessionalServiceIcon) leeft
 * aan de clientkant.
 */
export function BrandDealers({ dealers }: { dealers: CatalogDealer[] }) {
  return (
    <div className="credits-grid">
      {dealers.map((d) => {
        const Icon = resolveProfessionalServiceIcon(d.service)
        return (
          <Link key={d.companyId} href={`/professionals/${d.slug}`} className="credit-card">
            {d.service && <span className="arco-eyebrow">{d.service}</span>}
            <div className="credit-icon">
              {d.logoUrl
                ? <LogoFill src={d.logoUrl} alt={d.name} />
                : <Icon className="credit-icon-service" strokeWidth={1} aria-hidden />}
            </div>
            <h3 className="arco-label">{d.name}</h3>
            {d.city && <p className="discover-card-sub" style={{ marginTop: 2 }}>{d.city}</p>}
          </Link>
        )
      })}
    </div>
  )
}
