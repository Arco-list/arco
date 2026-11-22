"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Link } from "@/i18n/navigation"
import { QuickRow } from "@/components/quick-row"

import { categoryLabel, categoryTree, collectionKindsLabel, type CatalogBrand, type CatalogCategory, type CatalogCollection } from "@/lib/products/catalog-types"
import { CollectionCard } from "@/components/catalog/catalog-cards"
import { LayeredFilterPanel, layeredPillLabel, nextLayeredSelection, type LayeredGroup } from "@/components/filters/layered-filter"
import { ProductImage } from "@/components/catalog/product-image"
import { BrandCardLogo } from "@/components/brand/brand-card-logo"
import { DrawerSection } from "@/components/filters/drawer-section"
import { SortLinks } from "@/components/sort-links"
import { productGroupIcon } from "@/lib/icons/product-groups"

/**
 * De productdiscover, in de vorm van /projects en /professionals: de
 * filterbalk met pills, de chipstrip, het titelblok, de teller en de grid.
 *
 * Zonder keuze is de pagina geen lijst maar een ingang — een volle grid
 * van alles is een vergaarbak. Dan: titel met body, de zes hoofdgroepen
 * als cirkels, de merken als staande kaarten (de kaartvorm van home) en
 * een rij uitgelichte collecties. Zodra iets gekozen is (merk, soort, of de
 * soort van een soortpagina) komt de grid.
 *
 * Alles client-side over de hele lijst: 35 collecties vandaag, en ook met
 * duizend is dit sneller dan een rondreis. De keuze staat in de URL
 * (?brand=occhio&kind=pendant) zodat hij deelbaar en terugknop-vast is.
 */

type Props = {
  locale: string
  collection: CatalogCollection[]
  brands: CatalogBrand[]
  categories: CatalogCategory[]
  /** Soortpagina: deze soort (en alles eronder) staat vast. */
  fixedKind?: CatalogCategory | null
}

const COPY = {
  nl: {
    title: "Designmerken in architectuurprojecten",
    kinds: "Soorten",
    brands: "Merken",
    allBrands: "Alle merken",
    featured: "Uitgelicht",
    collection: "collecties",
    collectionOne: "collectie",
    noResults: "Geen collecties",
    noResultsBody: "Niets binnen deze keuze. Wis een filter om meer te zien.",
    brand: "Merk",
    kind: "Soort",
    clearAll: "Alles wissen",
    products: "Producten",
    allFilters: "Alle filters",
    showResults: "Resultaten tonen",
    searchBrand: "Zoek een merk…",
    selected: (n: number) => `${n} geselecteerd`,
  },
  en: {
    title: "Design brands in architecture projects",
    kinds: "Kinds",
    brands: "Brands",
    allBrands: "All brands",
    featured: "Featured",
    collection: "collections",
    collectionOne: "collection",
    noResults: "No collections",
    noResultsBody: "Nothing within this selection. Clear a filter to see more.",
    brand: "Brand",
    kind: "Kind",
    clearAll: "Clear all",
    products: "Products",
    allFilters: "All filters",
    showResults: "Show results",
    searchBrand: "Search a brand…",
    selected: (n: number) => `${n} selected`,
  },
} as const

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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

const SORTS = ["most_relevant", "Alphabetical"] as const
type Sort = (typeof SORTS)[number]

const split = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [])

export function ProductsDiscoverClient({ locale, collection, brands, categories, fixedKind = null }: Props) {
  const t = COPY[locale === "nl" ? "nl" : "en"]
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tree = useMemo(() => categoryTree(categories), [categories])
  // Op een kaart met merk: merk · hoofdsoort ("DEDON · Loungesets"). De
  // eerste soort is de belangrijkste; de rest staat op de collectiepagina.
  const kindOf = (s: CatalogCollection) => collectionKindsLabel(s, tree.byId, locale, 1, false)

  // ── Keuze, uit de URL ──────────────────────────────────────────────
  const brandParam = searchParams.get("brand")
  const kindParam = searchParams.get("kind")
  const selectedBrands = useMemo(() => split(brandParam), [brandParam])
  // Op een soortpagina (/products/meubels) versmalt ?kind= binnen die soort.
  const selectedKinds = useMemo(() => split(kindParam), [kindParam])
  const sort: Sort = searchParams.get("sort") === "az" ? "Alphabetical" : "most_relevant"
  const setParams = (brand: string[], kind: string[], nextSort: Sort = sort) => {
    const p = new URLSearchParams()
    if (brand.length) p.set("brand", brand.join(","))
    if (kind.length) p.set("kind", kind.join(","))
    if (nextSort === "Alphabetical") p.set("sort", "az")
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  // Soort kiezen, ook vanaf een soortpagina: blijft de keuze binnen deze
  // soort, dan versmalt ?kind= de pagina; de soort zelf = geen versmalling;
  // buiten de soort (een andere groep) gaat het naar /products met die keuze.
  const applyKinds = (next: string[]) => {
    if (!fixedKind) return setParams(selectedBrands, next)
    const inside = tree.subtreeIds(fixedKind.id)
    const within = next.every((slug) => { const c = tree.bySlug.get(slug); return c ? inside.has(c.id) : false })
    if (next.length > 0 && within) return setParams(selectedBrands, next.filter((slug) => slug !== fixedKind.slug))
    // Naar een andere soort: overschakelen (de soort van deze pagina valt
    // weg). Eén soort = zijn eigen pagina, meer = /products met die keuze.
    const outside = next.filter((slug) => slug !== fixedKind.slug)
    const p = new URLSearchParams()
    if (selectedBrands.length) p.set("brand", selectedBrands.join(","))
    if (outside.length === 1) return router.push(p.toString() ? `/products/${outside[0]}?${p.toString()}` : `/products/${outside[0]}`)
    if (outside.length > 1) p.set("kind", outside.join(","))
    router.push(p.toString() ? `/products?${p.toString()}` : "/products")
  }
  const toggleBrand = (slug: string) => setParams(selectedBrands.includes(slug) ? selectedBrands.filter((s) => s !== slug) : [...selectedBrands, slug], selectedKinds)
  const toggleKind = (slug: string) => setParams(selectedBrands, selectedKinds.includes(slug) ? selectedKinds.filter((s) => s !== slug) : [...selectedKinds, slug])
  const clearAll = () => setParams([], [])
  const browsing = !fixedKind && selectedBrands.length === 0 && selectedKinds.length === 0

  // ── Filteren ───────────────────────────────────────────────────────
  const kindIds = useMemo(() => {
    const picked = selectedKinds.map((s) => tree.bySlug.get(s)).filter((c): c is CatalogCategory => Boolean(c))
    const roots = picked.length > 0 ? picked : fixedKind ? [fixedKind] : []
    if (roots.length === 0) return null
    const ids = new Set<string>()
    for (const r of roots) for (const id of tree.subtreeIds(r.id)) ids.add(id)
    return ids
  }, [fixedKind, selectedKinds, tree])
  const inKind = (s: CatalogCollection) => !kindIds || (s.categoryId !== null && kindIds.has(s.categoryId))
  const inBrand = (s: CatalogCollection) => selectedBrands.length === 0 || selectedBrands.includes(s.brand.slug)
  const byRelevance = (a: CatalogCollection, b: CatalogCollection) => b.projectCount - a.projectCount || a.name.localeCompare(b.name)
  const byName = (a: CatalogCollection, b: CatalogCollection) => a.name.localeCompare(b.name)
  const visible = collection.filter((s) => inKind(s) && inBrand(s)).sort(sort === "Alphabetical" ? byName : byRelevance)

  // Tellers per optie, binnen de andere as: zo zie je wat een keuze oplevert.
  const brandCounts = new Map<string, number>()
  for (const s of collection.filter(inKind)) brandCounts.set(s.brand.slug, (brandCounts.get(s.brand.slug) ?? 0) + 1)
  const kindCount = (c: CatalogCategory) => {
    const ids = tree.subtreeIds(c.id)
    return collection.filter((s) => inBrand(s) && s.categoryId !== null && ids.has(s.categoryId)).length
  }
  const brandOptions = brands.filter((b) => (brandCounts.get(b.slug) ?? 0) > 0 || selectedBrands.includes(b.slug))
  // Wat de Soort-pill als gekozen toont: de versmalling, anders de soort
  // van de pagina zelf.
  const kindSelection = selectedKinds.length > 0 ? selectedKinds : fixedKind ? [fixedKind.slug] : []
  // Soort: groep › subgroep (het menu toont twee lagen; een subgroep omvat
  // zijn soorten). Alleen wat collecties heeft, of al gekozen is.
  const kindGroups: LayeredGroup[] = tree.roots
    .map((g) => ({
      id: g.slug,
      label: categoryLabel(g, locale),
      count: kindCount(g),
      children: tree.children(g.id)
        .map((c) => ({ id: c.slug, label: categoryLabel(c, locale), count: kindCount(c) }))
        .filter((c) => c.count > 0 || kindSelection.includes(c.id)),
    }))
    .filter((g) => g.count > 0 || kindSelection.includes(g.id) || g.children.length > 0)

  // ── De ingang (zonder keuze) ───────────────────────────────────────
  // Hoofdgroep als schijf met een uitsnede, zoals de ruimtes op /projects:
  // het eigen beeld van de groep (admin › categorieën), anders de
  // productfoto (op wit) van de meest toegepaste collectie erin. Zonder
  // collecties het lijnicoon van de groep, nooit een lege schijf.
  const groups = tree.roots.map((group) => {
    const ids = tree.subtreeIds(group.id)
    const inGroup = collection.filter((s) => s.categoryId !== null && ids.has(s.categoryId)).sort(byRelevance)
    return { group, count: inGroup.length, imageUrl: group.imageUrl ?? inGroup.find((s) => s.productImageUrl)?.productImageUrl ?? null }
  })
  // Merk: staande kaart met het beeld van zijn meest toegepaste collectie,
  // het logo erin, de naam eronder — de kaartvorm van home.
  const brandCards = brands
    .filter((b) => b.collectionCount > 0)
    .map((b) => {
      const own = collection.filter((s) => s.brand.id === b.id).sort(byRelevance)
      return { brand: b, imageUrl: own.find((s) => s.heroImageUrl)?.heroImageUrl ?? null }
    })
    .sort((a, b) => b.brand.projectCount - a.brand.projectCount || b.brand.collectionCount - a.brand.collectionCount || a.brand.name.localeCompare(b.brand.name))
  // ── Soortpagina (/products/meubels) zonder verdere keuze ───────────
  // Zelfde opbouw als /products: subgroepen als schijven (bij een
  // hoofdgroep), de merken binnen de soort als carrousel, dan de lijst.
  const groupView = Boolean(fixedKind) && selectedBrands.length === 0 && selectedKinds.length === 0
  const fixedIds = fixedKind ? tree.subtreeIds(fixedKind.id) : null
  const inFixed = (s: CatalogCollection) => !fixedIds || (s.categoryId !== null && fixedIds.has(s.categoryId))
  const subgroupDiscs = fixedKind && !fixedKind.parentId
    ? tree.children(fixedKind.id)
        .map((sub) => {
          const ids = tree.subtreeIds(sub.id)
          const inSub = collection.filter((s) => s.categoryId !== null && ids.has(s.categoryId)).sort(byRelevance)
          return { group: sub, count: inSub.length, imageUrl: sub.imageUrl ?? inSub.find((s) => s.productImageUrl)?.productImageUrl ?? null }
        })
        .filter((d) => d.count > 0)
    : []
  const fixedBrandCards = brandCards
    .filter(({ brand }) => collection.some((s) => s.brand.id === brand.id && inFixed(s)))
    .map(({ brand }) => {
      const own = collection.filter((s) => s.brand.id === brand.id && inFixed(s)).sort(byRelevance)
      return { brand, imageUrl: own.find((s) => s.heroImageUrl)?.heroImageUrl ?? null }
    })

  // Uitgelicht: met de hand gekozen; zonder keuze de meest toegepaste.
  const featuredPicked = collection.filter((s) => s.isFeatured).sort(byRelevance)
  const featured = (featuredPicked.length > 0 ? featuredPicked : collection.filter((s) => s.heroImageUrl).sort(byRelevance)).slice(0, 8)

  // ── Dropdowns ──────────────────────────────────────────────────────
  const [open, setOpen] = useState<"brand" | "kind" | null>(null)
  // Lade "Alle filters" (zoals op projecten en professionals).
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [brandSearch, setBrandSearch] = useState("")
  const [expandedKinds, setExpandedKinds] = useState<Record<string, boolean | undefined>>({})
  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", drawerOpen)
    return () => document.body.classList.remove("overflow-hidden")
  }, [drawerOpen])
  const barRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null) }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const chips: Array<{ key: string; label: string; remove: () => void }> = [
    ...selectedBrands.map((slug) => ({ key: `b-${slug}`, label: brands.find((b) => b.slug === slug)?.name ?? slug, remove: () => toggleBrand(slug) })),
    ...selectedKinds.map((slug) => { const c = tree.bySlug.get(slug); return { key: `k-${slug}`, label: c ? tree.pathOf(c.id).map((p) => categoryLabel(p, locale)).join(" › ") : slug, remove: () => toggleKind(slug) } }),
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

  // Merken als carrousel van staande kaarten (/products en soortpagina's):
  // hele kaarten, pijlen op het midden van het beeld (de kaart is 2 : 3,
  // dus op driekwart van de kaartbreedte). Hooguit tien merken.
  const brandCarousel = (cards: Array<{ brand: CatalogBrand; imageUrl: string | null }>, allHref: string) => cards.length === 0 ? null : (
    <section className="wrap" style={{ paddingBottom: 56 }}>
      <div className="section-header">
        <h2 className="arco-section-title">{t.brands}</h2>
        <Link href={allHref} className="view-all-link">
          <span className="arco-text-link-label">{t.allBrands}</span>
          <span aria-hidden>→</span>
        </Link>
      </div>
      <QuickRow minTile={{ desktop: 220, mobile: 160 }} gap={16} fill arrowTop="calc(var(--quick-tile-w, 220px) * 0.75)">
        {cards.slice(0, 10).map(({ brand, imageUrl }) => (
          <Link key={brand.id} href={`/brands/${brand.slug}`} className="quick-row-item group">
            <div className="relative w-full overflow-hidden mb-2.5" style={{ aspectRatio: "2/3", background: "var(--arco-surface)" }}>
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt={brand.name} className="absolute inset-0 h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.04]" />
              )}
              {brand.logoUrl && (
                <span className="absolute left-4 top-4">
                  <BrandCardLogo logoUrl={brand.logoUrl} name={brand.name} />
                </span>
              )}
            </div>
            <span className="arco-card-title" style={{ paddingLeft: 2 }}>{brand.name}</span>
          </Link>
        ))}
      </QuickRow>
    </section>
  )

  // Soorten als schijven met een uitsnede (of het icoon van de hoofdgroep).
  const discRow = (items: Array<{ group: CatalogCategory; imageUrl: string | null }>, iconSlug: (c: CatalogCategory) => string) => items.length === 0 ? null : (
    <div className="wrap" style={{ paddingTop: 0, paddingBottom: 48 }}>
      <QuickRow>
        {items.map(({ group, imageUrl }) => (
          <Link key={group.id} href={`/products/${group.slug}`} className="credit-card service-quick-card quick-tile">
            <div className="credit-icon" style={{ overflow: "hidden" }}>
              {imageUrl ? (
                <ProductImage url={imageUrl} alt={categoryLabel(group, locale)} padding="14%" />
              ) : (
                (() => { const Icon = productGroupIcon(iconSlug(group)); return <Icon className="credit-icon-service" strokeWidth={1} aria-hidden /> })()
              )}
            </div>
            <h3 className="quick-tile-label">{categoryLabel(group, locale)}</h3>
          </Link>
        ))}
      </QuickRow>
    </div>
  )

  return (
    <>
      {/* ── Filterbalk ─────────────────────────────────────────────── */}
      <div className="discover-filter-bar" ref={barRef}>
        <div className="wrap">
          <div className="discover-filter-inner">
            <button
              type="button"
              className="filter-pill"
              data-active={selectedBrands.length + selectedKinds.length > 0 || undefined}
              onClick={() => { setOpen(null); setDrawerOpen(true) }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <line x1="1.5" y1="3.5" x2="11.5" y2="3.5" />
                <line x1="3.5" y1="6.5" x2="9.5" y2="6.5" />
                <line x1="5.5" y1="9.5" x2="7.5" y2="9.5" />
              </svg>
              {t.allFilters}
              {selectedBrands.length + selectedKinds.length > 0 && <span className="filter-pill-badge">{selectedBrands.length + selectedKinds.length}</span>}
            </button>
            <div className="filter-pill-divider" />
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

            {(
              <div className="filter-pill-group" style={{ position: "relative" }}>
                <button
                  type="button"
                  className="filter-pill"
                  data-active={selectedKinds.length > 0 || Boolean(fixedKind) || undefined}
                  data-open={open === "kind" || undefined}
                  onClick={() => setOpen(open === "kind" ? null : "kind")}
                  aria-expanded={open === "kind"}
                >
                  {layeredPillLabel(kindGroups, kindSelection, t.kind, locale)}
                  <ChevronDownIcon className="filter-pill-chevron" />
                </button>
                <div className="filter-dropdown" data-open={open === "kind" ? "true" : undefined}>
                  {open === "kind" && (
                    <LayeredFilterPanel
                      groups={kindGroups}
                      selected={kindSelection}
                      onChange={applyKinds}
                      locale={locale}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Lade "Alle filters" ─────────────────────────────────────── */}
      <div className="discover-drawer-backdrop" data-open={drawerOpen} onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      <aside className="discover-drawer" data-open={drawerOpen} role="dialog" aria-modal="true" aria-label={t.allFilters}>
        <div className="discover-drawer-header">
          <span className="discover-drawer-title">{t.allFilters}</span>
          <button type="button" className="discover-drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M2 2l10 10M12 2L2 12" /></svg>
          </button>
        </div>
        <div className="discover-drawer-body">
          {(
            <DrawerSection title={t.kind} activeCount={kindSelection.length} selectedLabel={t.selected(kindSelection.length)}>
              <div className="drawer-option-list">
                {kindGroups.map((g) => {
                  const groupChecked = kindSelection.includes(g.id)
                  const childCount = g.children.filter((c) => kindSelection.includes(c.id)).length
                  const isExpanded = expandedKinds[g.id] ?? (childCount > 0 || groupChecked)
                  const pick = (childId: string | null) => applyKinds(nextLayeredSelection(kindGroups, kindSelection, g.id, childId))
                  return (
                    <div key={g.id}>
                      <div className="drawer-option" data-checked={groupChecked}>
                        <div
                          className="drawer-option-left"
                          role="option"
                          aria-selected={groupChecked}
                          tabIndex={0}
                          style={{ cursor: "pointer", flex: 1 }}
                          onClick={() => pick(null)}
                          onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); pick(null) } }}
                        >
                          <div className="drawer-option-checkbox">{groupChecked && <CheckIcon />}</div>
                          <span className="drawer-option-label" style={{ fontWeight: 500 }}>{g.label}</span>
                          {childCount > 0 && <span className="filter-pill-badge">{childCount}</span>}
                        </div>
                        {g.children.length > 0 && (
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            aria-label={g.label}
                            onClick={() => setExpandedKinds((prev) => ({ ...prev, [g.id]: !isExpanded }))}
                            className="drawer-option-expand"
                          >
                            <svg width="7" height="11" viewBox="0 0 7 11" fill="none" aria-hidden style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}>
                              <path d="M1.5 1.5l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {isExpanded && g.children.map((c) => {
                        const checked = kindSelection.includes(c.id)
                        return (
                          <div
                            key={c.id}
                            role="option"
                            aria-selected={checked}
                            tabIndex={0}
                            className="drawer-option"
                            data-checked={checked}
                            style={{ paddingLeft: 26 }}
                            onClick={() => pick(c.id)}
                            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); pick(c.id) } }}
                          >
                            <div className="drawer-option-left">
                              <div className="drawer-option-checkbox">{checked && <CheckIcon />}</div>
                              <span className="drawer-option-label">{c.label}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </DrawerSection>
          )}

          <DrawerSection title={t.brand} activeCount={selectedBrands.length} selectedLabel={t.selected(selectedBrands.length)}>
            <input className="drawer-search" type="text" placeholder={t.searchBrand} value={brandSearch} onChange={(e) => setBrandSearch(e.target.value)} />
            <div className="drawer-option-list" style={{ maxHeight: 280, overflowY: "auto" }}>
              {brandOptions
                .filter((b) => !brandSearch.trim() || b.name.toLowerCase().includes(brandSearch.trim().toLowerCase()))
                .map((b) => {
                  const checked = selectedBrands.includes(b.slug)
                  return (
                    <div
                      key={b.id}
                      role="option"
                      aria-selected={checked}
                      tabIndex={0}
                      className="drawer-option"
                      data-checked={checked}
                      onClick={() => toggleBrand(b.slug)}
                      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleBrand(b.slug) } }}
                    >
                      <div className="drawer-option-left">
                        <div className="drawer-option-checkbox">{checked && <CheckIcon />}</div>
                        <span className="drawer-option-label">{b.name}</span>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{brandCounts.get(b.slug) ?? 0}</span>
                    </div>
                  )
                })}
            </div>
          </DrawerSection>
        </div>
        <div className="discover-drawer-footer">
          <button type="button" className="discover-drawer-clear" onClick={() => { clearAll(); setBrandSearch(""); setDrawerOpen(false) }}>{t.clearAll}</button>
          <button type="button" className="discover-drawer-apply" onClick={() => setDrawerOpen(false)}>{t.showResults}</button>
        </div>
      </aside>

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
              <nav aria-label="Breadcrumb" className="discover-breadcrumb">
                <span className="discover-breadcrumb-item discover-breadcrumb-current">{t.products}</span>
              </nav>
              <h1 className="arco-section-title">{t.title}</h1>
            </div>
          </div>

          {/* ── Hoofdgroepen als schijven ─────────────────────────── */}
          {discRow(groups, (g) => g.slug)}

          {/* ── Merken: staande kaarten ───────────────────────────── */}
          {brandCarousel(brandCards, "/brands")}

          {/* ── Uitgelicht ────────────────────────────────────────── */}
          {featured.length > 0 && (
            <section className="wrap" style={{ paddingBottom: 72 }}>
              <div className="section-header">
                <h2 className="arco-section-title">{t.featured}</h2>
              </div>
              <div className="discover-grid">
                {featured.map((s) => <CollectionCard key={s.id} collection={s} locale={locale} kind={kindOf(s)} />)}
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
                  <Fragment key={c.id}>
                    <span className="discover-breadcrumb-sep" aria-hidden="true">/</span>
                    {i === path.length - 1 ? (
                      <span className="discover-breadcrumb-item discover-breadcrumb-current">{categoryLabel(c, locale)}</span>
                    ) : (
                      <Link href={`/products/${c.slug}`} className="discover-breadcrumb-item">{categoryLabel(c, locale)}</Link>
                    )}
                  </Fragment>
                ))}
              </nav>
              <h1 className="arco-section-title">{filteredTitle}</h1>
            </div>
          </div>

          {/* Soortpagina zonder verdere keuze: dezelfde opbouw als /products. */}
          {groupView && fixedKind && (
            <>
              {discRow(subgroupDiscs, () => (tree.rootOf(fixedKind.id) ?? fixedKind).slug)}
              {brandCarousel(fixedBrandCards, `/brands?kind=${fixedKind.slug}`)}
            </>
          )}

          <div className="discover-results">
            <div className="wrap">
              <div className="discover-results-meta" style={{ justifyContent: "space-between" }}>
                <p className="discover-results-count">
                  <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{visible.length.toLocaleString()}</strong> {visible.length === 1 ? t.collectionOne : t.collection}
                </p>
                <SortLinks options={SORTS} current={sort} onChange={(next) => setParams(selectedBrands, selectedKinds, next)} />
              </div>
              {visible.length === 0 ? (
                <div className="empty-state" style={{ padding: "64px 16px" }}>
                  <h2 className="arco-section-title empty-state__title">{t.noResults}</h2>
                  <p className="arco-body-text empty-state__description">{t.noResultsBody}</p>
                </div>
              ) : (
                <div className="discover-grid">
                  {visible.map((s) => <CollectionCard key={s.id} collection={s} locale={locale} kind={kindOf(s)} />)}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
