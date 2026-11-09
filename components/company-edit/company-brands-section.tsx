"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale } from "next-intl"
import { toast } from "sonner"

import { addCompanyBrandAction, removeCompanyBrandAction, setCompanyBrandDealerAction } from "@/app/dashboard/company/actions"

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
}

export type BrandOption = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
}

const COPY = {
  nl: {
    title: "Merken",
    intro: "Merken die je voert of installeert. Ze staan op je pagina en jij staat als verkooppunt op de merkpagina.",
    add: "Merk toevoegen",
    empty: "Nog geen merken.",
    emptyHint: "Voeg de merken toe die je voert, bijvoorbeeld het keukenmerk of het zwembadsysteem waarmee je werkt.",
    dealer: "Officieel dealer",
    remove: "Verwijderen",
    search: "Zoek een merk…",
    none: "Geen merken gevonden.",
    allAdded: "Alle merken zijn al toegevoegd.",
    added: "Merk toegevoegd",
    removed: "Merk verwijderd",
    error: "Opslaan mislukt",
    close: "Sluiten",
  },
  en: {
    title: "Brands",
    intro: "Brands you carry or install. They show on your page, and you are listed as a point of sale on the brand page.",
    add: "Add brand",
    empty: "No brands yet.",
    emptyHint: "Add the brands you work with, for example the kitchen brand or pool system you install.",
    dealer: "Official dealer",
    remove: "Remove",
    search: "Search a brand…",
    none: "No brands found.",
    allAdded: "Every brand has been added.",
    added: "Brand added",
    removed: "Brand removed",
    error: "Could not save",
    close: "Close",
  },
}

function Disc({ name, logoUrl, size = 100 }: { name: string; logoUrl: string | null; size?: number }) {
  return (
    <div className="credit-icon" style={{ width: size, height: size, overflow: "hidden", margin: 0 }}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span className="credit-icon-initials" style={{ fontSize: size < 60 ? 16 : 32 }}>{name.charAt(0).toUpperCase()}</span>
      )}
    </div>
  )
}

export function CompanyBrandsSection({ companyId, brands: initial, options }: { companyId: string; brands: CompanyBrandLink[]; options: BrandOption[] }) {
  const locale = useLocale()
  const c = locale === "nl" ? COPY.nl : COPY.en
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [brands, setBrands] = useState(initial)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const have = useMemo(() => new Set(brands.map((b) => b.id)), [brands])
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options
      .filter((o) => !have.has(o.id))
      .filter((o) => !q || o.name.toLowerCase().includes(q))
      .slice(0, 40)
  }, [options, have, query])

  const add = (o: BrandOption) => {
    setBusy(o.id)
    const next: CompanyBrandLink = { ...o, isOfficialDealer: false }
    setBrands((prev) => [...prev, next])
    startTransition(async () => {
      const result = await addCompanyBrandAction({ brandId: o.id }, companyId)
      setBusy(null)
      if (!result.success) {
        setBrands((prev) => prev.filter((b) => b.id !== o.id))
        toast.error(result.error ?? c.error)
        return
      }
      toast.success(c.added)
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
      toast.success(c.removed)
      router.refresh()
    })
  }

  const toggleDealer = (id: string, on: boolean) => {
    setBrands((prev) => prev.map((b) => (b.id === id ? { ...b, isOfficialDealer: on } : b)))
    startTransition(async () => {
      const result = await setCompanyBrandDealerAction({ brandId: id, isOfficialDealer: on }, companyId)
      if (!result.success) {
        setBrands((prev) => prev.map((b) => (b.id === id ? { ...b, isOfficialDealer: !on } : b)))
        toast.error(result.error ?? c.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <section id="brands" style={{ marginBottom: 60 }}>
      <div className="wrap">
        <div className="section-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="arco-section-title">{c.title}</h2>
          <button type="button" className="btn-primary" style={{ fontSize: 13, padding: "8px 18px" }} onClick={() => { setQuery(""); setOpen(true) }}>
            {c.add}
          </button>
        </div>
        <p className="arco-body-text" style={{ color: "#8c8c8a", marginBottom: 24, maxWidth: 600 }}>{c.intro}</p>

        {brands.length === 0 ? (
          <div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: "48px 24px", textAlign: "center" }}>
            <p className="arco-eyebrow" style={{ marginBottom: 8 }}>{c.empty}</p>
            <p className="arco-body-text" style={{ color: "#a1a1a0", margin: "0 auto", maxWidth: 420 }}>{c.emptyHint}</p>
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: "16px 24px" }}>
            {brands.map((b) => (
              <li key={b.id} style={{ width: 150, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <Disc name={b.name} logoUrl={b.logoUrl} />
                <span className="arco-card-title" style={{ fontSize: 14, marginTop: 12 }}>{b.name}</span>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: b.isOfficialDealer ? "var(--primary)" : "#8c8c8a", cursor: "pointer" }}>
                  <input type="checkbox" checked={b.isOfficialDealer} onChange={(e) => toggleDealer(b.id, e.target.checked)} style={{ accentColor: "var(--primary)" }} />
                  {c.dealer}
                </label>
                <button type="button" onClick={() => remove(b.id)} style={{ background: "none", border: "none", padding: 0, marginTop: 6, fontSize: 12, color: "#a1a1a0", cursor: "pointer" }}>
                  {c.remove}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && (
        <div className="popup-overlay" onClick={() => setOpen(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">{c.add}</h3>
              <button type="button" className="popup-close" onClick={() => setOpen(false)} aria-label={c.close}>✕</button>
            </div>
            <input
              autoFocus
              className="input-base input-default"
              style={{ width: "100%", marginBottom: 12 }}
              placeholder={c.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {candidates.length === 0 ? (
                <p className="arco-body-text" style={{ color: "#a1a1a0", padding: "16px 0", textAlign: "center" }}>
                  {options.length > 0 && options.every((o) => have.has(o.id)) ? c.allAdded : c.none}
                </p>
              ) : candidates.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={busy === o.id}
                  onClick={() => add(o)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", border: "none", background: "none", borderRadius: 4, cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#f5f5f4" }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
                >
                  <Disc name={o.name} logoUrl={o.logoUrl} size={40} />
                  <span style={{ fontSize: 14, color: "#1c1c1a" }}>{o.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
