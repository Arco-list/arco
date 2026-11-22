"use client"

import { useMemo, useState, type ReactNode } from "react"
import { BRAND_GRID_GAP } from "@/components/brand/brand-rows"
import { useLocale } from "next-intl"
import { Check, Plus, X } from "lucide-react"

import { useBrandLogoFit } from "@/components/brand/brand-logo"

/**
 * De merkkiezer zoals de bedrijfseditor en de projecteditor hem delen
 * (/admin/design → Disc tiles):
 *
 * - BrandTileList: de gekozen merken als disc tiles; bij hover een kruis
 *   op de schijf, klik haalt het merk weg.
 * - BrandPickerPopup: zoekveld (ook een geplakte lijst), hoofdcategorieën
 *   als pills, drie kolommen disc tiles. Klik voegt toe of haalt weg; een
 *   gekozen merk draagt de primaire badge rechtsboven op de schijf.
 *
 * Opslaan doet de ouder: de kiezer meldt alleen wat er gekozen wordt.
 */

export type BrandPickOption = { id: string; name: string; logoUrl: string | null; categoryIds?: string[] }
export type BrandPickCategory = { id: string; name: string; nameNl: string | null }

const COPY = {
  nl: {
    search: "Zoek een merk, of plak een lijst",
    listFound: (n: number, t: number) => `${n} ${n === 1 ? "merk" : "merken"} gevonden voor ${t} namen`,
    listMissing: (names: string) => `niet gevonden: ${names}`,
    addAll: (n: number) => `Alle ${n} toevoegen`,
    none: "Geen merken gevonden.",
    all: "Alle",
    addedTag: "Toegevoegd",
    addAria: (n: string) => `${n} toevoegen`,
    removeAria: (n: string) => `${n} verwijderen`,
    close: "Sluiten",
  },
  en: {
    search: "Search a brand, or paste a list",
    listFound: (n: number, t: number) => `${n} ${n === 1 ? "brand" : "brands"} found for ${t} names`,
    listMissing: (names: string) => `not found: ${names}`,
    addAll: (n: number) => `Add all ${n}`,
    none: "No brands found.",
    all: "All",
    addedTag: "Added",
    addAria: (n: string) => `Add ${n}`,
    removeAria: (n: string) => `Remove ${n}`,
    close: "Close",
  },
}

/** Logo in de schijf: eigen achtergrond vult, wit of doorzichtig op grijs met marge. */
export function BrandPickDisc({ name, logoUrl, children }: { name: string; logoUrl: string | null; children?: ReactNode }) {
  const { full, imgProps } = useBrandLogoFit(logoUrl)
  return (
    <div className="credit-icon" style={{ overflow: "hidden", position: "relative" }}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          {...imgProps}
          src={logoUrl}
          alt={name}
          className={full ? "credit-cutout" : undefined}
          style={full ? undefined : { width: "100%", height: "100%", objectFit: "contain", padding: "7%", boxSizing: "border-box", mixBlendMode: "multiply" }}
        />
      ) : (
        <span className="credit-icon-initials" style={{ fontSize: 32 }}>{name.charAt(0).toUpperCase()}</span>
      )}
      {children}
    </div>
  )
}

/** De gekozen merken; klik op een tegel haalt het merk weg. */
export function BrandTileList({ brands, onRemove, disabled }: { brands: BrandPickOption[]; onRemove: (id: string) => void; disabled?: boolean }) {
  const locale = useLocale()
  const c = locale === "nl" ? COPY.nl : COPY.en
  if (brands.length === 0) return null
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: BRAND_GRID_GAP }}>
      {brands.map((b) => (
        <button
          key={b.id}
          type="button"
          disabled={disabled}
          onClick={() => onRemove(b.id)}
          aria-label={c.removeAria(b.name)}
          className="credit-card service-quick-card quick-tile"
        >
          <BrandPickDisc name={b.name} logoUrl={b.logoUrl}>
            <span className="brand-pick-badge brand-pick-badge--remove" aria-hidden>
              <X size={16} />
            </span>
          </BrandPickDisc>
          <h3 className="quick-tile-label">{b.name}</h3>
        </button>
      ))}
    </div>
  )
}

export function BrandPickerPopup({
  title,
  options,
  filterCategories = [],
  selectedIds,
  busyId,
  onAdd,
  onRemove,
  onAddMany,
  onClose,
}: {
  title: string
  options: BrandPickOption[]
  filterCategories?: BrandPickCategory[]
  selectedIds: Set<string>
  busyId?: string | null
  onAdd: (o: BrandPickOption) => void
  onRemove: (id: string) => void
  onAddMany: (list: BrandPickOption[]) => void
  onClose: () => void
}) {
  const locale = useLocale()
  const c = locale === "nl" ? COPY.nl : COPY.en
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string | null>(null)

  // Een lijst plakken ("Artemide, Flos, Vibia" of één merk per regel)
  // toont alle genoemde merken. Vergelijken zonder hoofdletters, spaties
  // en leestekens, in beide richtingen: "B&B" vindt "B&B Italia", "Flos
  // lighting" vindt "Flos".
  const norm = (v: string) => v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "")
  const matches = (name: string, t: string) => { const n = norm(name); return n.includes(t) || (t.length >= 4 && t.includes(n)) }
  const terms = useMemo(() => query.split(/[,;\n|]+/).map((t) => norm(t)).filter((t) => t.length >= 2), [query])
  const isList = terms.length > 1
  const candidates = useMemo(() => options
    .filter((o) => terms.length === 0 || terms.some((t) => matches(o.name, t)))
    .filter((o) => !category || (o.categoryIds ?? []).includes(category)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [options, terms, category])
  const missing = useMemo(() => {
    if (!isList) return []
    return query.split(/[,;\n|]+/).map((t) => t.trim()).filter((t) => norm(t).length >= 2)
      .filter((t) => !options.some((o) => matches(o.name, norm(t))))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isList, query, options])
  const addable = candidates.filter((o) => !selectedIds.has(o.id))

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="popup-header">
          <h3 className="arco-section-title">{title}</h3>
          <button type="button" className="popup-close" onClick={onClose} aria-label={c.close}>✕</button>
        </div>
        <input
          autoFocus
          className="input-base input-default"
          style={{ width: "100%", marginBottom: 12 }}
          placeholder={c.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onPaste={(e) => {
            // Een tekstveld slikt regeleinden in: zet een geplakte lijst
            // met één merk per regel om naar komma's.
            const text = e.clipboardData.getData("text")
            if (!/\n/.test(text)) return
            e.preventDefault()
            const el = e.currentTarget
            const start = el.selectionStart ?? query.length
            const end = el.selectionEnd ?? query.length
            const pasted = text.split(/\r?\n/).map((t) => t.trim()).filter(Boolean).join(", ")
            setQuery(query.slice(0, start) + pasted + query.slice(end))
          }}
        />
        {filterCategories.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            <button type="button" className="filter-pill" data-active={category === null ? "true" : undefined} onClick={() => setCategory(null)} style={{ fontSize: 13 }}>
              {c.all}
            </button>
            {filterCategories.map((fc) => (
              <button
                key={fc.id}
                type="button"
                className="filter-pill"
                data-active={category === fc.id ? "true" : undefined}
                onClick={() => setCategory(category === fc.id ? null : fc.id)}
                style={{ fontSize: 13 }}
              >
                {locale === "nl" && fc.nameNl ? fc.nameNl : fc.name}
              </button>
            ))}
          </div>
        )}
        {isList && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <span className="arco-body-text" style={{ fontSize: 13, color: "#6b6b68" }}>
              {c.listFound(candidates.length, terms.length)}
              {missing.length > 0 && <span style={{ color: "#a1a1a0" }}> · {c.listMissing(missing.join(", "))}</span>}
            </span>
            {addable.length > 0 && (
              <button type="button" className="btn-secondary" style={{ fontSize: 13, padding: "6px 14px" }} onClick={() => onAddMany(addable)}>
                {c.addAll(addable.length)}
              </button>
            )}
          </div>
        )}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {candidates.length === 0 ? (
            <p className="arco-body-text" style={{ color: "#a1a1a0", padding: "16px 0", textAlign: "center" }}>{c.none}</p>
          ) : (
            <div className="brand-pick-grid">
              {candidates.map((o) => {
                const selected = selectedIds.has(o.id)
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={busyId === o.id}
                    onClick={() => (selected ? onRemove(o.id) : onAdd(o))}
                    aria-pressed={selected}
                    aria-label={selected ? c.removeAria(o.name) : c.addAria(o.name)}
                    className="credit-card service-quick-card quick-tile"
                  >
                    <div className="quick-tile-disc">
                      <BrandPickDisc name={o.name} logoUrl={o.logoUrl}>
                        <span className={`brand-pick-badge${selected ? " brand-pick-badge--remove" : ""}`} aria-hidden>
                          {selected ? <X size={16} /> : <Plus size={16} />}
                        </span>
                      </BrandPickDisc>
                      {selected && (
                        <span className="quick-tile-badge" role="img" aria-label={c.addedTag}>
                          <Check size={12} strokeWidth={3} aria-hidden />
                        </span>
                      )}
                    </div>
                    <h3 className="quick-tile-label">{o.name}</h3>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
