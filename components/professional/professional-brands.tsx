import { getTranslations } from "next-intl/server"

import type { ProfessionalBrand } from "@/lib/professionals/types"

/**
 * "Merken" op de bedrijfspagina: de merken die het bedrijf voert, met
 * het dealerlabel waar dat is aangegeven. Dezelfde rijen staan op de
 * merkpagina als "Verkooppunten" (company_brands, migratie 297). Nog
 * zonder link naar de merkpagina: de productlaag is admin-only.
 */
export async function ProfessionalBrands({ brands }: { brands: ProfessionalBrand[] }) {
  if (brands.length === 0) return null
  const t = await getTranslations("professional_detail")

  return (
    <section id="brands" style={{ marginBottom: 60 }}>
      <div className="wrap">
        <div className="section-header">
          <h2 className="arco-section-title">{t("brands")}</h2>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: "8px 24px" }}>
          {brands.map((b) => (
            <li key={b.id} style={{ width: 150, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div className="credit-icon" style={{ overflow: "hidden", marginBottom: 12 }}>
                {b.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.logoUrl} alt={b.name} className="credit-icon-image" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span className="credit-icon-initials">{b.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <span className="arco-card-title" style={{ fontSize: 14 }}>{b.name}</span>
              {b.isOfficialDealer && (
                <span className="arco-eyebrow" style={{ marginTop: 4, color: "var(--primary)" }}>{t("official_dealer")}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
