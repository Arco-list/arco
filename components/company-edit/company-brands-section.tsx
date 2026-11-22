"use client"

import { useMemo, useState, useTransition } from "react"
import { BrandPickerPopup, BrandTileList } from "@/components/brand/brand-picker"
import { useRouter } from "next/navigation"
import { BrandCategoryPills, useBrandCategoryPills } from "@/components/brand/brand-category-pills"
import { BrandRows } from "@/components/brand/brand-rows"
import { useLocale } from "next-intl"
import { toast } from "sonner"

import { addCompanyBrandAction, removeCompanyBrandAction } from "@/app/dashboard/company/actions"

/**
 * "Merken" in de bedrijfseditor: welke merken het bedrijf voert, met per
 * merk de dealerclaim. Relevant voor keukenbouwers (Gaggenau), zwembad-
 * bouwers (Compass), smart-home-installateurs, tuinontwerpers (Drop).
 * Dezelfde rij is op de merkpagina een verkooppunt (company_brands).
 * Hoe "officieel dealer" bevestigd wordt, komt later.
 */

export type CompanyBrandLink = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  isOfficialDealer: boolean
  /** Hoofdcategorieën, voor de filterpills boven de merken. */
  categoryIds?: string[]
}

export type BrandOption = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  /** Hoofdcategorieën (Verlichting, Meubels…) voor de filterpills. */
  categoryIds?: string[]
}

export type BrandFilterCategory = { id: string; name: string; nameNl: string | null }

const COPY = {
  nl: {
    title: "Merken",
    intro: "De merken waarvan je officieel dealer bent.",
    add: "Merk toevoegen",
    empty: "Nog geen merken.",
    emptyHint: "Voeg de merken toe die je voert, bijvoorbeeld het keukenmerk of het zwembadsysteem waarmee je werkt.",
    dealer: "Officieel dealer",
    remove: "Verwijderen",
    search: "Zoek een merk, of plak een lijst",
    listFound: (n: number, t: number) => `${n} ${n === 1 ? "merk" : "merken"} gevonden voor ${t} namen`,
    listMissing: (names: string) => `niet gevonden: ${names}`,
    addAll: (n: number) => `Alle ${n} toevoegen`,
    addedMany: (n: number) => (n === 1 ? "Merk toegevoegd" : `${n} merken toegevoegd`),
    none: "Geen merken gevonden.",
    all: "Alle",
    addedTag: "Toegevoegd",
    addAria: (n: string) => `${n} toevoegen`,
    removeAria: (n: string) => `${n} verwijderen`,
    allAdded: "Alle merken zijn al toegevoegd.",
    added: "Merk toegevoegd",
    removed: "Merk verwijderd",
    error: "Opslaan mislukt",
    close: "Sluiten",
  },
  en: {
    title: "Brands",
    intro: "The brands you are an official dealer for.",
    add: "Add brand",
    empty: "No brands yet.",
    emptyHint: "Add the brands you work with, for example the kitchen brand or pool system you install.",
    dealer: "Official dealer",
    remove: "Remove",
    search: "Search a brand, or paste a list",
    listFound: (n: number, t: number) => `${n} ${n === 1 ? "brand" : "brands"} found for ${t} names`,
    listMissing: (names: string) => `not found: ${names}`,
    addAll: (n: number) => `Add all ${n}`,
    addedMany: (n: number) => (n === 1 ? "Brand added" : `${n} brands added`),
    none: "No brands found.",
    all: "All",
    addedTag: "Added",
    addAria: (n: string) => `Add ${n}`,
    removeAria: (n: string) => `Remove ${n}`,
    allAdded: "Every brand has been added.",
    added: "Brand added",
    removed: "Brand removed",
    error: "Could not save",
    close: "Close",
  },
}


export function CompanyBrandsSection({ companyId, brands: initial, options, filterCategories = [] }: { companyId: string; brands: CompanyBrandLink[]; options: BrandOption[]; filterCategories?: BrandFilterCategory[] }) {
  const locale = useLocale()
  const c = locale === "nl" ? COPY.nl : COPY.en
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [brands, setBrands] = useState(initial)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const { pills, current, visible } = useBrandCategoryPills(brands, filterCategories, category)

  const have = useMemo(() => new Set(brands.map((b) => b.id)), [brands])

  const addAll = (list: BrandOption[]) => {
    if (list.length === 0) return
    setBrands((prev) => [...prev, ...list.map((o) => ({ ...o, isOfficialDealer: true }))])
    startTransition(async () => {
      let failed = 0
      for (const o of list) {
        const result = await addCompanyBrandAction({ brandId: o.id }, companyId)
        if (!result.success) {
          failed += 1
          setBrands((prev) => prev.filter((b) => b.id !== o.id))
        }
      }
      if (failed > 0) toast.error(c.error)
      router.refresh()
    })
  }

  const add = (o: BrandOption) => {
    setBusy(o.id)
    const next: CompanyBrandLink = { ...o, isOfficialDealer: true }
    setBrands((prev) => [...prev, next])
    startTransition(async () => {
      const result = await addCompanyBrandAction({ brandId: o.id }, companyId)
      setBusy(null)
      if (!result.success) {
        setBrands((prev) => prev.filter((b) => b.id !== o.id))
        toast.error(result.error ?? c.error)
        return
      }
      router.refresh()
    })
  }

  const remove = (id: string) => {
    const before = brands
    setBrands((prev) => prev.filter((b) => b.id !== id))
    startTransition(async () => {
      const result = await removeCompanyBrandAction({ brandId: id }, companyId)
      if (!result.success) {
        setBrands(before)
        toast.error(result.error ?? c.error)
        return
      }
      router.refresh()
    })
  }



  return (
    <section id="brands" style={{ marginBottom: 60 }}>
      <div className="wrap">
        {/* Titel en intro als één blok, zoals de secties in de projecteditor
            (Fototour, Vermelde professionals): intro 6px onder de titel. */}
        <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 className="arco-section-title">{c.title}</h2>
            <p className="arco-body-text" style={{ color: "#8c8c8a", marginTop: 6, marginBottom: 0, maxWidth: 600 }}>{c.intro}</p>
          </div>
          <button type="button" className="btn-primary" style={{ fontSize: 13, padding: "8px 18px" }} onClick={() => setOpen(true)}>
            {c.add}
          </button>
        </div>

        {/* Leeg: geen kader, de knop en de intro zeggen genoeg. */}
        <BrandCategoryPills pills={pills} total={brands.length} current={current} onChange={setCategory} locale={locale} />
        <BrandRows items={visible} resetKey={current} locale={locale} render={(rows) => <BrandTileList brands={rows} onRemove={remove} />} />
      </div>

      {open && (
        <BrandPickerPopup
          title={c.add}
          options={options}
          filterCategories={filterCategories}
          selectedIds={have}
          busyId={busy}
          onAdd={(o) => add(o as BrandOption)}
          onRemove={remove}
          onAddMany={(list) => addAll(list as BrandOption[])}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  )
}
