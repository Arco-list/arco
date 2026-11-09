"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Link } from "@/i18n/navigation"
import { QuickRow } from "@/components/quick-row"

import { categoryLabel, categoryTree, type CatalogBrand, type CatalogCategory, type CatalogSeries } from "@/lib/products/catalog-types"
import { SeriesCard } from "@/components/catalog/catalog-cards"

/**
 * De productdiscover, in de vorm van /projects en /professionals: de
 * filterbalk met pills, de chipstrip, het titelblok, de teller en de grid.
 *
 * Zonder keuze is de pagina geen lijst maar een ingang — een volle grid
 * van alles is een vergaarbak. Dan: titel met body, de zes hoofdgroepen
 * als cirkels, de merken als staande kaarten (de kaartvorm van home) en
 * een rij uitgelichte series. Zodra iets gekozen is (merk, soort, of de
 * soort van een soortpagina) komt de grid.
 *
 * Alles client-side over de hele lijst: 35 series vandaag, en ook met
 * duizend is dit sneller dan een rondreis. De keuze staat in de URL
 * (?brand=occhio&kind=pendant) zodat hij deelbaar en terugknop-vast is.
 */

type Props = {
  locale: string
  series: CatalogSeries[]
  brands: CatalogBrand[]
  categories: CatalogCategory[]
  /** Soortpagina: deze soort (en alles eronder) staat vast. */
  fixedKind?: CatalogCategory | null
}

const COPY = {
  nl: {
    title: "Merken uit architectuurprojecten in Nederland",
    kinds: "Soorten",
    brands: "Merken",
    allBrands: "Alle merken",
    featured: "Uitgelicht",
    series: "series",
    noResults: "Geen series",
    noResultsBody: "Niets binnen deze keuze. Wis een filter om meer te zien.",
    brand: "Merk",
    kind: "Soort",
    clearAll: "Alles wissen",
    products: "Producten",
  },
  en: {
    title: "Brands from architecture projects in the Netherlands",
    kinds: "Kinds",
    brands: "Brands",
    allBrands: "All brands",
    featured: "Featured",
    series: "series",
    noResults: "No series",
    noResultsBody: "Nothing within this selection. Clear a filter to see more.",
    brand: "Brand",
    kind: "Kind",
    clearAll: "Clear all",
    products: "Products",
  },
} as const

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 5l2.2 2.2L8 3" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const split = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [])

export function ProductsDiscoverClient({ locale, series, brands, categories, fixedKind = null }: Props) {
  const t = COPY[locale === "nl" ? "nl" : "en"]
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tree = useMemo(() => categoryTree(categories), [categories])

  // ── Keuze, uit de URL ──────────────────────────────────────────────
  const brandParam = searchParams.get("brand")
  const kindParam = searchParams.get("kind")
  const selectedBrands = useMemo(() => split(brandParam), [brandParam])
  const selectedKinds = useMemo(() => (fixedKind ? [] : split(kindParam)), [fixedKind, kindParam])
  const setParams = (brand: string[], kind: string[]) => {
    const p = new URLSearchParams()
    if (brand.length) p.set("brand", brand.join(","))
    if (kind.length) p.set("kind", kind.join(","))
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  const toggleBrand = (slug: string) => setParams(selectedBrands.includes(slug) ? selectedBrands.filter((s) => s !== slug) : [...selectedBrands, slug], selectedKinds)
  const toggleKind = (slug: string) => setParams(selectedBrands, selectedKinds.includes(slug) ? selectedKinds.filter((s) => s !== slug) : [...selectedKinds, slug])
  const clearAll = () => setParams([], [])
  const browsing = !fixedKind && selectedBrands.length === 0 && selectedKinds.length === 0

  // ── Filteren ───────────────────────────────────────────────────────
  const kindIds = useMemo(() => {
    const roots = fixedKind ? [fixedKind] : selectedKinds.map((s) => tree.bySlug.get(s)).filter((c): c is CatalogCategory => Boolean(c))
    if (roots.length === 0) return null
    const ids = new Set<string>()
    for (const r of roots) for (const id of tree.subtreeIds(r.id)) ids.add(id)
    return ids
  }, [fixedKind, selectedKinds, tree])
  const inKind = (s: CatalogSeries) => !kindIds || (s.categoryId !== null && kindIds.has(s.categoryId))
  const inBrand = (s: CatalogSeries) => selectedBrands.length === 0 || selectedBrands.includes(s.brand.slug)
  const byRelevance = (a: CatalogSeries, b: CatalogSeries) => b.projectCount - a.projectCount || a.name.localeCompare(b.name)
  const visible = series.filter((s) => inKind(s) && inBrand(s)).sort(byRelevance)

  // Tellers per optie, binnen de andere as: zo zie je wat een keuze oplevert.
  const brandCounts = new Map<string, number>()
  for (const s of series.filter(inKind)) brandCounts.set(s.brand.slug, (brandCounts.get(s.brand.slug) ?? 0) + 1)
  const kindCount = (c: CatalogCategory) => {
    const ids = tree.subtreeIds(c.id)
    return series.filter((s) => inBrand(s) && s.categoryId !== null && ids.has(s.categoryId)).length
  }
  const brandOptions = brands.filter((b) => (brandCounts.get(b.slug) ?? 0) > 0 || selectedBrands.includes(b.slug))

  // ── De ingang (zonder keuze) ───────────────────────────────────────
  // Hoofdgroep: beeld van de meest toegepaste serie erin.
  const groups = tree.roots.map((group) => {
    const ids = tree.subtreeIds(group.id)
    const inGroup = series.filter((s) => s.categoryId !== null && ids.has(s.categoryId)).sort(byRelevance)
    return { group, count: inGroup.length, imageUrl: inGroup.find((s) => s.heroImageUrl)?.heroImageUrl ?? null }
  })
  // Merk: staande kaart met het beeld van zijn meest toegepaste serie,
  // het logo erin, de naam eronder — de kaartvorm van home.
  const brandCards = brands
    .filter((b) => b.seriesCount > 0)
    .map((b) => {
      const own = series.filter((s) => s.brand.id === b.id).sort(byRelevance)
      return { brand: b, imageUrl: own.find((s) => s.heroImageUrl)?.heroImageUrl ?? null }
    })
    .sort((a, b) => b.brand.projectCount - a.brand.projectCount || b.brand.seriesCount - a.brand.seriesCount || a.brand.name.localeCompare(b.brand.name))
  // Uitgelicht: met de hand gekozen; zonder keuze de meest toegepaste.
  const featuredPicked = series.filter((s) => s.isFeatured).sort(byRelevance)
  const featured = (featuredPicked.length > 0 ? featuredPicked : series.filter((s) => s.heroImageUrl).sort(byRelevance)).slice(0, 8)

  // ── Dropdowns ──────────────────────────────────────────────────────
  const [open, setOpen] = useState<"brand" | "kind" | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null) }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const chips: Array<{ key: string; label: string; remove: () => void }> = [
    ...selectedBrands.map((slug) => ({ key: `b-${slug}`, label: brands.find((b) => b.slug === slug)?.name ?? slug, remove: () => toggleBrand(slug) })),
    ...selectedKinds.map((slug) => { const c = tree.bySlug.get(slug); return { key: `k-${slug}`, label: c ? categoryLabel(c, locale) : slug, remove: () => toggleKind(slug) } }),
  ]

  const path = fixedKind ? tree.pathOf(fixedKind.id) : []
  const filteredTitle = fixedKind
    ? categoryLabel(fixedKind, locale)
    : selectedBrands.length === 1 && selectedKinds.length === 0
      ? brands.find((b) => b.slug === selectedBrands[0])?.name ?? t.products
      : selectedKinds.length === 1 && selectedBrands.length === 0
        ? categoryLabel(tree.bySlug.get(selectedKinds[0])!, locale)
        : t.products

  const option = (checked: boolean, label: string, count: number, onToggle: () => void, extra?: React.CSSProperties, bold?: boolean) => (
    <div
      className="filter-dropdown-option"
      data-checked={checked || undefined}
      role="option"
      aria-selected={checked}
      tabIndex={0}
      style={extra}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onToggle() } }}
    >
      <div className="filter-dropdown-option-left">
        <div className="filter-checkbox">{checked && <CheckIcon />}</div>
        <span className="filter-dropdown-label" style={bold ? { fontWeight: 500 } : undefined}>{label}</span>
      </div>
      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{count}</span>
    </div>
  )

  return (
    <>
      {/* ── Filterbalk ─────────────────────────────────────────────── */}
      <div className="discover-filter-bar" ref={barRef}>
        <div className="wrap">
          <div className="discover-filter-inner">
            <div className="filter-pill-group" style={{ position: "relative" }}>
              <button
                type="button"
                className="filter-pill"
                data-active={selectedBrands.length > 0 || undefined}
                data-open={open === "brand" || undefined}
                onClick={() => setOpen(open === "brand" ? null : "brand")}
                aria-expanded={open === "brand"}
              >
                {t.brand}
                {selectedBrands.length > 0 && <span className="filter-pill-badge">{selectedBrands.length}</span>}
                <ChevronDownIcon className="filter-pill-chevron" />
              </button>
              <div className="filter-dropdown" data-open={open === "brand" ? "true" : undefined} style={{ minWidth: 260 }}>
                <div style={{ maxHeight: 360, overflowY: "auto" }}>
                  {brandOptions.map((b) => (
                    <div key={b.id}>{option(selectedBrands.includes(b.slug), b.name, brandCounts.get(b.slug) ?? 0, () => toggleBrand(b.slug))}</div>
                  ))}
                </div>
              </div>
            </div>

            {!fixedKind && (
              <div className="filter-pill-group" style={{ position: "relative" }}>
                <button
                  type="button"
                  className="filter-pill"
                  data-active={selectedKinds.length > 0 || undefined}
                  data-open={open === "kind" || undefined}
                  onClick={() => setOpen(open === "kind" ? null : "kind")}
                  aria-expanded={open === "kind"}
                >
                  {t.kind}
                  {selectedKinds.length > 0 && <span className="filter-pill-badge">{selectedKinds.length}</span>}
                  <ChevronDownIcon className="filter-pill-chevron" />
                </button>
                <div className="filter-dropdown" data-open={open === "kind" ? "true" : undefined} style={{ minWidth: 280 }}>
                  <div style={{ maxHeight: 360, overflowY: "auto" }}>
                    {tree.roots.map((group) => {
                      const n = kindCount(group)
                      if (n === 0) return null
                      return (
                        <div key={group.id}>
                          {option(selectedKinds.includes(group.slug), categoryLabel(group, locale), n, () => toggleKind(group.slug), undefined, true)}
                          {tree.children(group.id).filter((k) => kindCount(k) > 0).map((k) => (
                            <div key={k.id}>{option(selectedKinds.includes(k.slug), categoryLabel(k, locale), kindCount(k), () => toggleKind(k.slug), { paddingLeft: 36 })}</div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Chipstrip ──────────────────────────────────────────────── */}
      {chips.length > 0 && (
        <div className="discover-chip-strip">
          <div className="wrap">
            <div className="discover-chip-strip-inner">
              {chips.map((chip) => (
                <button key={chip.key} type="button" className="filter-chip" onClick={chip.remove} aria-label={`Remove ${chip.label}`}>
                  {chip.label}
                  <span className="filter-chip-close" aria-hidden="true">✕</span>
                </button>
              ))}
              <button type="button" className="filter-chip-clear-all" onClick={clearAll}>{t.clearAll}</button>
            </div>
          </div>
        </div>
      )}

      {browsing ? (
        <>
          {/* ── De ingang: titel en body ─────────────────────────── */}
          <div className="discover-page-title">
            <div className="wrap">
              <h1 className="arco-section-title">{t.title}</h1>
            </div>
          </div>

          {/* ── Zes hoofdgroepen als cirkels ──────────────────────── */}
          <div className="wrap" style={{ paddingTop: 0, paddingBottom: 48 }}>
            <QuickRow>
              {groups.map(({ group, count, imageUrl }) => (
                <Link
                  key={group.id}
                  href={`/products/${group.slug}`}
                  className="credit-card service-quick-card quick-tile"
                  style={{ opacity: count > 0 ? 1 : 0.45 }}
                >
                  <div className="credit-icon" style={{ overflow: "hidden" }}>
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt={categoryLabel(group, locale)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : null}
                  </div>
                  <h3 className="quick-tile-label">{categoryLabel(group, locale)}</h3>
                </Link>
              ))}
            </QuickRow>
          </div>

          {/* ── Merken: staande kaarten ───────────────────────────── */}
          {brandCards.length > 0 && (
            <section className="wrap" style={{ paddingBottom: 56 }}>
              <div className="section-header">
                <h2 className="arco-section-title">{t.brands}</h2>
                <Link href="/brands" className="view-all-link">
                  <span className="arco-text-link-label">{t.allBrands}</span>
                  <span aria-hidden>→</span>
                </Link>
              </div>
              <div className="grid grid-cols-5 max-lg:flex max-lg:overflow-x-auto max-lg:snap-x max-lg:snap-mandatory max-lg:scrollbar-hide" style={{ gap: "var(--grid-gap)" }}>
                {brandCards.slice(0, 10).map(({ brand, imageUrl }) => (
                  <Link key={brand.id} href={`/brands/${brand.slug}`} className="block flex-shrink-0 lg:w-auto max-lg:w-[30vw] max-md:w-[42vw] snap-start group">
                    <div className="relative w-full overflow-hidden mb-2.5" style={{ aspectRatio: "2/3", background: "var(--arco-surface)" }}>
                      {imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl} alt={brand.name} className="absolute inset-0 h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.04]" />
                      )}
                      {brand.logoUrl && (
                        <span className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={brand.logoUrl} alt="" className="h-full w-full object-cover" />
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 px-0.5">
                      <span className="arco-card-title">{brand.name}</span>
                      <span className="discover-card-sub" style={{ margin: 0 }}>{brand.seriesCount} {t.series}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Uitgelicht ────────────────────────────────────────── */}
          {featured.length > 0 && (
            <section className="wrap" style={{ paddingBottom: 72 }}>
              <div className="section-header">
                <h2 className="arco-section-title">{t.featured}</h2>
              </div>
              <div className="discover-grid">
                {featured.map((s) => <SeriesCard key={s.id} series={s} locale={locale} />)}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          {/* ── Met keuze: kop, teller, grid ──────────────────────── */}
          <div className="discover-page-title">
            <div className="wrap">
              <nav aria-label="Breadcrumb" className="discover-breadcrumb">
                <Link href="/products" className="discover-breadcrumb-item">{t.products}</Link>
                {path.map((c, i) => (
                  <span key={c.id}>
                    <span className="discover-breadcrumb-sep" aria-hidden="true">/</span>
                    {i === path.length - 1 ? (
                      <span className="discover-breadcrumb-item discover-breadcrumb-current">{categoryLabel(c, locale)}</span>
                    ) : (
                      <Link href={`/products/${c.slug}`} className="discover-breadcrumb-item">{categoryLabel(c, locale)}</Link>
                    )}
                  </span>
                ))}
              </nav>
              <h1 className="arco-section-title">{filteredTitle}</h1>
            </div>
          </div>

          <div className="discover-results">
            <div className="wrap">
              <div className="discover-results-meta" style={{ justifyContent: "space-between" }}>
                <p className="discover-results-count">
                  <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{visible.length.toLocaleString()}</strong> {t.series}
                </p>
              </div>
              {visible.length === 0 ? (
                <div className="empty-state" style={{ padding: "64px 16px" }}>
                  <h2 className="arco-section-title empty-state__title">{t.noResults}</h2>
                  <p className="arco-body-text empty-state__description">{t.noResultsBody}</p>
                </div>
              ) : (
                <div className="discover-grid">
                  {visible.map((s) => <SeriesCard key={s.id} series={s} locale={locale} />)}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
