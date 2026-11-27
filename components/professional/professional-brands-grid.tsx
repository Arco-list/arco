"use client"

import { useState } from "react"
import { useLocale } from "next-intl"

import type { ProfessionalBrand } from "@/lib/professionals/types"
import { QuickRow } from "@/components/quick-row"
import { BrandCard } from "@/components/brand/brand-card"
import { BrandCategoryPills, useBrandCategoryPills, type BrandCategoryOption } from "@/components/brand/brand-category-pills"

/**
 * De merken op de bedrijfspagina: een carrousel van staande merkkaarten,
 * zoals op /products (beeld van een collectie, logo linksboven), met
 * filterpills per hoofdcategorie. Nog zonder link naar de merkpagina: de
 * productlaag is admin-only.
 */
export function ProfessionalBrandsGrid({ brands, categories }: { brands: ProfessionalBrand[]; categories: BrandCategoryOption[] }) {
  const locale = useLocale()
  const [category, setCategory] = useState<string | null>(null)
  const { pills, current, visible } = useBrandCategoryPills(brands, categories, category)

  return (
    <>
      <BrandCategoryPills pills={pills} total={brands.length} current={current} onChange={setCategory} locale={locale} showCounts={false} />
      {/* Pijlen op het midden van het beeld: de kaart is 2 : 3, dus op
          driekwart van de kaartbreedte. Andere pill: de rij begint opnieuw. */}
      <QuickRow key={current ?? "all"} minTile={{ desktop: 220, mobile: 160 }} gap={16} fill arrowTop="calc(var(--quick-tile-w, 220px) * 0.75)">
        {visible.map((b) => (
          <BrandCard key={b.id} name={b.name} logoUrl={b.logoUrl} imageUrl={b.imageUrl ?? null} />
        ))}
      </QuickRow>
    </>
  )
}
