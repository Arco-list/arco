"use client"

import { useMemo } from "react"

/**
 * Filterpills boven de merken van een bedrijf, zoals de ruimtes boven de
 * Fototour: "Alle · 12", "Verlichting · 5", "Meubels · 4"… per
 * hoofdcategorie van de merken die het bedrijf voert. Gebruikt op de
 * bedrijfspagina en in company edit. Net als de Fototour: in de editor
 * met aantallen ("Alle · 12"), op de publieke pagina zonder ("Alles").
 *
 * Alleen als de merken over minstens twee hoofdcategorieën verdeeld zijn:
 * "Alle · 5" naast "Keukens · 5" filtert niets. Een merk zonder categorie
 * telt alleen mee in Alle.
 */

export type BrandCategoryOption = { id: string; name: string; nameNl: string | null }

export function useBrandCategoryPills<T extends { id: string; categoryIds?: string[] }>(
  brands: T[],
  categories: BrandCategoryOption[],
  active: string | null,
) {
  return useMemo(() => {
    const count = new Map<string, number>()
    for (const b of brands) for (const id of new Set(b.categoryIds ?? [])) count.set(id, (count.get(id) ?? 0) + 1)
    const pills = categories
      .filter((c) => (count.get(c.id) ?? 0) > 0)
      .map((c) => ({ ...c, count: count.get(c.id) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    const show = pills.length >= 2
    // Valt de actieve categorie weg (merk verwijderd), dan weer Alle.
    const current = show && active && pills.some((p) => p.id === active) ? active : null
    const visible = current ? brands.filter((b) => b.categoryIds?.includes(current)) : brands
    return { pills: show ? pills : [], current, visible }
  }, [brands, categories, active])
}

export function BrandCategoryPills({ pills, total, current, onChange, locale, showCounts = true }: {
  pills: Array<BrandCategoryOption & { count: number }>
  total: number
  current: string | null
  onChange: (id: string | null) => void
  locale: string
  /** Aantallen in de pills; uit op de publieke pagina, zoals de Fototour. */
  showCounts?: boolean
}) {
  if (pills.length === 0) return null
  return (
    <div className="category-tags" style={{ marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" className={`category-tag${current === null ? " active" : ""}`} onClick={() => onChange(null)}>
        {showCounts ? `${locale === "nl" ? "Alle" : "All"} · ${total}` : locale === "nl" ? "Alles" : "All"}
      </button>
      {pills.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`category-tag${current === p.id ? " active" : ""}`}
          onClick={() => onChange(p.id)}
        >
          {(locale === "nl" ? p.nameNl : null) ?? p.name}{showCounts ? ` · ${p.count}` : ""}
        </button>
      ))}
    </div>
  )
}
