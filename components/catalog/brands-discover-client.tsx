"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Link } from "@/i18n/navigation"

import { categoryLabel, categoryTree, type CatalogBrand, type CatalogCategory } from "@/lib/products/catalog-types"
import { BrandDisc } from "@/components/brand/brand-disc"
import { SortLinks } from "@/components/sort-links"
import { LayeredFilterPanel, layeredPillLabel, nextLayeredSelection, type LayeredGroup } from "@/components/filters/layered-filter"
import { DrawerSection } from "@/components/filters/drawer-section"

/**
 * /brands als discover, in de vorm van /products: dezelfde filterbalk
 * ("Alle filters" met lade, Merk, Soort; meerdere keuzes, als chips
 * eronder), het kruimelpad (Producten › groep › subgroep › Merken), de
 * teller met sortering, en een grid van disc tiles (logo en naam, zoals
 * op /admin/design).
 *
 * De keuze staat in de URL (?kind=a,b&brand=x,y). Bij precies één soort
 * volgen kruimelpad en titel die soort. Een hoofdgroep toont ook de
 * merken in zijn subgroepen. Alles client-side: een paar duizend merken
 * filteren is sneller dan een rondreis.
 */

const COPY = {
  nl: {
    titleFor: (k: string) => `Merken voor ${k.toLowerCase()}`, products: "Producten", brands: "Merken", kind: "Soort", brandPill: "Merk",
    brand: (n: number) => (n === 1 ? "merk" : "merken"), none: "Geen merken", noneBody: "Niets binnen deze keuze. Wis een filter om meer te zien.",
    clear: "Alles wissen", allFilters: "Alle filters", showResults: "Resultaten tonen", searchBrand: "Zoek een merk…",
    selected: (n: number) => `${n} geselecteerd`, more: (n: number) => `Nog ${n} merken: zoek om ze te vinden`,
  },
  en: {
    titleFor: (k: string) => `${k} brands`, products: "Products", brands: "Brands", kind: "Kind", brandPill: "Brand",
    brand: (n: number) => (n === 1 ? "brand" : "brands"), none: "No brands", noneBody: "Nothing within this selection. Clear a filter to see more.",
    clear: "Clear all", allFilters: "All filters", showResults: "Show results", searchBrand: "Search a brand…",
    selected: (n: number) => `${n} selected`, more: (n: number) => `${n} more brands: search to find them`,
  },
} as const

const SORTS = ["most_relevant", "Alphabetical"] as const
type Sort = (typeof SORTS)[number]

/** Hoeveel merken een lijst zonder zoekterm toont; daarna zoeken. */
const LIST_CAP = 200

const split = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [])

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

export function BrandsDiscoverClient({ locale, brands, categories }: { locale: string; brands: CatalogBrand[]; categories: CatalogCategory[] }) {
  const t = COPY[locale === "nl" ? "nl" : "en"]
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tree = useMemo(() => categoryTree(categories), [categories])

  // ── Keuze, uit de URL (?kind=a,b&brand=x,y&sort=az) ────────────────
  const kindParam = searchParams.get("kind")
  const brandParam = searchParams.get("brand")
  const selectedKinds = useMemo(() => split(kindParam).filter((k) => tree.bySlug.has(k)), [kindParam, tree])
  const selectedBrands = useMemo(() => split(brandParam), [brandParam])
  const sort: Sort = searchParams.get("sort") === "az" ? "Alphabetical" : "most_relevant"
  const setParams = (brand: string[], kind: string[], nextSort: Sort = sort) => {
    const p = new URLSearchParams()
    if (brand.length) p.set("brand", brand.join(","))
    if (kind.length) p.set("kind", kind.join(","))
    if (nextSort === "Alphabetical") p.set("sort", "az")
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  const toggleBrand = (slug: string) => setParams(selectedBrands.includes(slug) ? selectedBrands.filter((s) => s !== slug) : [...selectedBrands, slug], selectedKinds)
  const applyKinds = (next: string[]) => setParams(selectedBrands, next)
  const toggleKind = (slug: string) => applyKinds(selectedKinds.includes(slug) ? selectedKinds.filter((s) => s !== slug) : [...selectedKinds, slug])
  const clearAll = () => setParams([], [])

  // ── Filteren ───────────────────────────────────────────────────────
  // Een merk hoort bij een soort als een van zijn categorieën eronder valt.
  const kindIds = useMemo(() => {
    if (selectedKinds.length === 0) return null
    const ids = new Set<string>()
    for (const slug of selectedKinds) { const c = tree.bySlug.get(slug); if (c) for (const id of tree.subtreeIds(c.id)) ids.add(id) }
    return ids
  }, [selectedKinds, tree])
  const inKinds = (b: CatalogBrand) => !kindIds || b.categoryIds.some((id) => kindIds.has(id))
  const inBrands = (b: CatalogBrand) => selectedBrands.length === 0 || selectedBrands.includes(b.slug)
  const inKind = (b: CatalogBrand, c: CatalogCategory) => {
    const ids = tree.subtreeIds(c.id)
    return b.categoryIds.some((id) => ids.has(id))
  }
  // Tellers per soort, binnen de gekozen merken: zo zie je wat een keuze oplevert.
  const count = (c: CatalogCategory) => brands.filter((b) => inBrands(b) && inKind(b, c)).length

  const visible = useMemo(() => {
    const list = brands.filter((b) => inKinds(b) && inBrands(b))
    return [...list].sort(sort === "Alphabetical"
      ? (a, b) => a.name.localeCompare(b.name)
      : (a, b) => b.projectCount - a.projectCount || b.collectionCount - a.collectionCount || a.name.localeCompare(b.name))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands, kindIds, selectedBrands, sort])

  // Groep › subgroep, alleen wat merken heeft. Een merk hangt hooguit aan
  // een subgroep, dus dieper hoeft het filter niet.
  const kindGroups: LayeredGroup[] = useMemo(() => tree.roots
    .map((g) => ({
      id: g.slug,
      label: categoryLabel(g, locale),
      count: count(g),
      children: tree.children(g.id)
        .map((c) => ({ id: c.slug, label: categoryLabel(c, locale), count: count(c) }))
        .filter((c) => c.count > 0 || selectedKinds.includes(c.id)),
    }))
    .filter((g) => g.count > 0 || selectedKinds.includes(g.id) || g.children.length > 0),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [tree, brands, locale, selectedBrands, selectedKinds])

  // Merkkeuze: wat binnen de gekozen soorten valt (plus wat al gekozen
  // is), op naam. Met bijna 2000 merken alleen de eerste LIST_CAP zonder
  // zoekterm.
  const brandOptionsFor = (query: string) => {
    const q = query.trim().toLowerCase()
    const all = brands
      .filter((b) => inKinds(b) || selectedBrands.includes(b.slug))
      .filter((b) => !q || b.name.toLowerCase().includes(q))
      .sort((a, b) => Number(selectedBrands.includes(b.slug)) - Number(selectedBrands.includes(a.slug)) || a.name.localeCompare(b.name))
    return { list: all.slice(0, LIST_CAP), rest: Math.max(0, all.length - LIST_CAP) }
  }

  // ── Dropdowns en lade ──────────────────────────────────────────────
  const [open, setOpen] = useState<"brand" | "kind" | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [brandSearch, setBrandSearch] = useState("")
  const [drawerSearch, setDrawerSearch] = useState("")
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
  const activeCount = selectedBrands.length + selectedKinds.length

  // Kruimelpad en titel volgen één gekozen soort; bij meer keuzes gewoon "Merken".
  const kind = selectedKinds.length === 1 && selectedBrands.length === 0 ? tree.bySlug.get(selectedKinds[0]) ?? null : null
  const path = kind ? tree.pathOf(kind.id) : []

  const brandRow = (b: CatalogBrand, drawer: boolean) => {
    const checked = selectedBrands.includes(b.slug)
    return (
      <div
        key={b.id}
        role="option"
        aria-selected={checked}
        tabIndex={0}
        className={drawer ? "drawer-option" : "filter-dropdown-option"}
        data-checked={drawer ? checked : checked || undefined}
        onClick={() => toggleBrand(b.slug)}
        onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleBrand(b.slug) } }}
      >
        <div className={drawer ? "drawer-option-left" : "filter-dropdown-option-left"}>
          <div className={drawer ? "drawer-option-checkbox" : "filter-checkbox"}>{checked && <CheckIcon />}</div>
          <span className={drawer ? "drawer-option-label" : "filter-dropdown-label"}>{b.name}</span>
        </div>
      </div>
    )
  }
  const dropdownBrands = brandOptionsFor(brandSearch)
  const drawerBrands = brandOptionsFor(drawerSearch)

  return (
    <>
      {/* ── Filterbalk: dezelfde als op /products ─────────────────────── */}
      <div className="discover-filter-bar" ref={barRef}>
        <div className="wrap">
          <div className="discover-filter-inner">
            <button
              type="button"
              className="filter-pill"
              data-active={activeCount > 0 || undefined}
              onClick={() => { setOpen(null); setDrawerOpen(true) }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <line x1="1.5" y1="3.5" x2="11.5" y2="3.5" />
                <line x1="3.5" y1="6.5" x2="9.5" y2="6.5" />
                <line x1="5.5" y1="9.5" x2="7.5" y2="9.5" />
              </svg>
              {t.allFilters}
              {activeCount > 0 && <span className="filter-pill-badge">{activeCount}</span>}
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
                {t.brandPill}
                {selectedBrands.length > 0 && <span className="filter-pill-badge">{selectedBrands.length}</span>}
                <ChevronDownIcon className="filter-pill-chevron" />
              </button>
              <div className="filter-dropdown" data-open={open === "brand" ? "true" : undefined} style={{ minWidth: 280 }}>
                {open === "brand" && (
                  <>
                    <input className="drawer-search" type="text" placeholder={t.searchBrand} value={brandSearch} onChange={(e) => setBrandSearch(e.target.value)} autoFocus style={{ margin: "4px 4px 8px", width: "calc(100% - 8px)" }} />
                    <div style={{ maxHeight: 360, overflowY: "auto" }}>
                      {dropdownBrands.list.map((b) => brandRow(b, false))}
                      {dropdownBrands.rest > 0 && <p style={{ fontSize: 12, color: "var(--text-secondary)", padding: "8px 12px", margin: 0 }}>{t.more(dropdownBrands.rest)}</p>}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="filter-pill-group" style={{ position: "relative" }}>
              <button
                type="button"
                className="filter-pill"
                data-active={selectedKinds.length > 0 || undefined}
                data-open={open === "kind" || undefined}
                onClick={() => setOpen(open === "kind" ? null : "kind")}
                aria-expanded={open === "kind"}
              >
                {layeredPillLabel(kindGroups, selectedKinds, t.kind, locale)}
                <ChevronDownIcon className="filter-pill-chevron" />
              </button>
              <div className="filter-dropdown" data-open={open === "kind" ? "true" : undefined}>
                {open === "kind" && (
                  <LayeredFilterPanel groups={kindGroups} selected={selectedKinds} onChange={applyKinds} locale={locale} />
                )}
              </div>
            </div>
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
          <DrawerSection title={t.kind} activeCount={selectedKinds.length} selectedLabel={t.selected(selectedKinds.length)}>
            <div className="drawer-option-list">
              {kindGroups.map((g) => {
                const groupChecked = selectedKinds.includes(g.id)
                const childCount = g.children.filter((c) => selectedKinds.includes(c.id)).length
                const isExpanded = expandedKinds[g.id] ?? (childCount > 0 || groupChecked)
                const pick = (childId: string | null) => applyKinds(nextLayeredSelection(kindGroups, selectedKinds, g.id, childId))
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
                      const checked = selectedKinds.includes(c.id)
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

          <DrawerSection title={t.brandPill} activeCount={selectedBrands.length} selectedLabel={t.selected(selectedBrands.length)}>
            <input className="drawer-search" type="text" placeholder={t.searchBrand} value={drawerSearch} onChange={(e) => setDrawerSearch(e.target.value)} />
            <div className="drawer-option-list" style={{ maxHeight: 280, overflowY: "auto" }}>
              {drawerBrands.list.map((b) => brandRow(b, true))}
              {drawerBrands.rest > 0 && <p style={{ fontSize: 12, color: "var(--text-secondary)", padding: "8px 0", margin: 0 }}>{t.more(drawerBrands.rest)}</p>}
            </div>
          </DrawerSection>
        </div>
        <div className="discover-drawer-footer">
          <button type="button" className="discover-drawer-clear" onClick={() => { clearAll(); setDrawerSearch(""); setDrawerOpen(false) }}>{t.clear}</button>
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
              <button type="button" className="filter-chip-clear-all" onClick={clearAll}>{t.clear}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Kruimelpad en kop ──────────────────────────────────────── */}
      <div className="discover-page-title">
        <div className="wrap">
          <nav aria-label="Breadcrumb" className="discover-breadcrumb">
            <Link href="/products" className="discover-breadcrumb-item">{t.products}</Link>
            {/* Losse elementen, geen omhulsel: de tussenruimte van het
                kruimelpad (gap) werkt alleen tussen directe kinderen. */}
            {path.map((c) => (
              <Fragment key={c.id}>
                <span className="discover-breadcrumb-sep" aria-hidden="true">/</span>
                <Link href={`/brands?kind=${c.slug}`} className="discover-breadcrumb-item">{categoryLabel(c, locale)}</Link>
              </Fragment>
            ))}
            <span className="discover-breadcrumb-sep" aria-hidden="true">/</span>
            <span className="discover-breadcrumb-item discover-breadcrumb-current">{t.brands}</span>
          </nav>
          <h1 className="arco-section-title">{kind ? t.titleFor(categoryLabel(kind, locale)) : t.brands}</h1>
        </div>
      </div>

      {/* ── Teller, sortering, grid ────────────────────────────────── */}
      <div className="discover-results">
        <div className="wrap">
          <div className="discover-results-meta" style={{ justifyContent: "space-between" }}>
            <p className="discover-results-count">
              <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{visible.length.toLocaleString()}</strong> {t.brand(visible.length)}
            </p>
            <SortLinks options={SORTS} current={sort} onChange={(s) => setParams(selectedBrands, selectedKinds, s)} />
          </div>
          {visible.length === 0 ? (
            <div className="empty-state" style={{ padding: "64px 16px" }}>
              <h2 className="arco-section-title empty-state__title">{t.none}</h2>
              <p className="arco-body-text empty-state__description">{t.noneBody}</p>
            </div>
          ) : (
            <div className="brands-disc-grid">
              {visible.map((b) => (
                <Link key={b.id} href={`/brands/${b.slug}`} className="credit-card service-quick-card quick-tile">
                  <div className="credit-icon">
                    <BrandDisc name={b.name} logoUrl={b.logoUrl} />
                  </div>
                  <h3 className="quick-tile-label">{b.name}</h3>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
