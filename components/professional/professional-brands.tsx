import { getTranslations } from "next-intl/server"

import type { ProfessionalBrand, ProfessionalDetail } from "@/lib/professionals/types"
import { ProfessionalBrandsGrid } from "@/components/professional/professional-brands-grid"

/**
 * "Merken" op de bedrijfspagina: de merken waarvan het bedrijf officieel
 * dealer is, als carrousel van merkkaarten, met filterpills per hoofdcategorie zoals de
 * Fototour. Dezelfde rijen staan op de merkpagina als "Verkooppunten"
 * (company_brands, migratie 297). Nog zonder link naar de merkpagina: de
 * productlaag is admin-only.
 */
export async function ProfessionalBrands({ brands, categories = [] }: { brands: ProfessionalBrand[]; categories?: ProfessionalDetail["brandCategories"] }) {
  if (brands.length === 0) return null
  const t = await getTranslations("professional_detail")

  return (
    <section id="brands" style={{ marginBottom: 60 }}>
      <div className="wrap">
        <div className="section-header">
          <h2 className="arco-section-title">{t("brands")}</h2>
        </div>
        <ProfessionalBrandsGrid brands={brands} categories={categories} />
      </div>
    </section>
  )
}
