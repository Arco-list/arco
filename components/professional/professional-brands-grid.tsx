"use client"

import { useState } from "react"
import { useLocale } from "next-intl"

import type { ProfessionalBrand } from "@/lib/professionals/types"
import { BrandDisc } from "@/components/brand/brand-disc"
import { BRAND_GRID_GAP, BrandRows } from "@/components/brand/brand-rows"
import { BrandCategoryPills, useBrandCategoryPills, type BrandCategoryOption } from "@/components/brand/brand-category-pills"

/** De merktegels op de bedrijfspagina, met filterpills per hoofdcategorie. */
export function ProfessionalBrandsGrid({ brands, categories }: { brands: ProfessionalBrand[]; categories: BrandCategoryOption[] }) {
  const locale = useLocale()
  const [category, setCategory] = useState<string | null>(null)
  const { pills, current, visible } = useBrandCategoryPills(brands, categories, category)

  return (
    <>
      <BrandCategoryPills pills={pills} total={brands.length} current={current} onChange={setCategory} locale={locale} showCounts={false} />
      {/* Disc tiles zoals op /admin/design: schijf van 100px op het grijs,
          logo-fit, naam eronder in .quick-tile-label. */}
      <BrandRows
        items={visible}
        resetKey={current}
        locale={locale}
        render={(rows) => (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: BRAND_GRID_GAP }}>
            {rows.map((b) => (
              <li key={b.id} className="credit-card service-quick-card quick-tile quick-tile--static">
                <div className="credit-icon">
                  <BrandDisc name={b.name} logoUrl={b.logoUrl} />
                </div>
                <h3 className="quick-tile-label">{b.name}</h3>
              </li>
            ))}
          </ul>
        )}
      />
    </>
  )
}
