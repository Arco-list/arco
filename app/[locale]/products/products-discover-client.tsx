"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import type { DiscoverProduct, DiscoverBrand, DiscoverCategory } from "./page"
import { SmartImage } from "@/components/smart-image"

const BRAND_INITIAL_SHOW = 8

interface Props {
  initialProducts: DiscoverProduct[]
  brands: DiscoverBrand[]
  categories: DiscoverCategory[]
  initialBrandSlug?: string
}

export function ProductsDiscoverClient({ initialProducts, brands, categories, initialBrandSlug }: Props) {
  const searchParams = useSearchParams()
  const initialBrandId = initialBrandSlug ? brands.find((b) => b.slug === initialBrandSlug)?.id : undefined
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(initialBrandId ? new Set([initialBrandId]) : new Set())
  // Auto-select a collection when linked from a product detail breadcrumb
  // via ?collection=familyName. Matched against the product's familyName.
  const initialCollection = searchParams.get("collection")
  const initialFamilyId = initialCollection
    ? initialProducts.find((p) => p.familyName === initialCollection)?.familyId ?? null
    : null
  const [selectedFamily, setSelectedFamily] = useState<string | null>(initialFamilyId)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [showAllBrands, setShowAllBrands] = useState(false)
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close filter dropdowns when the user clicks anywhere outside one.
  // Both dropdowns share a marker attribute so a single listener handles
  // them — the pill wrapper + the dropdown panel both carry it.
  useEffect(() => {
    if (!brandDropdownOpen && !categoryDropdownOpen) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Element | null
      if (t?.closest("[data-filter-dropdown]")) return
      setBrandDropdownOpen(false)
      setCategoryDropdownOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [brandDropdownOpen, categoryDropdownOpen])

  // Lock the background scroll while the drawer is open so a long list
  // of brands doesn't pull focus away from the filters.
  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", drawerOpen)
    return () => { document.body.classList.remove("overflow-hidden") }
  }, [drawerOpen])

  // Build hierarchical category sections
  const categorySections = useMemo(() => {
    const topLevel = categories.filter((c) => !c.parentId)
    // Phase 1: show all categories regardless of product count.
    return topLevel.map((parent) => ({
      parent,
      children: categories.filter((c) => c.parentId === parent.id),
    }))
  }, [categories])

  const childIdsOf = (parentId: string) => {
    const children = categories.filter((c) => c.parentId === parentId)
    return [parentId, ...children.map((c) => c.id)]
  }

  // Filter products
  const filtered = useMemo(() => {
    let result = initialProducts
    if (selectedBrands.size > 0) {
      result = result.filter((p) => selectedBrands.has(p.brandId))
    }
    if (selectedFamily) {
      result = result.filter((p) => p.familyId === selectedFamily)
    }
    if (selectedCategories.size > 0) {
      const matchIds = new Set<string>()
      for (const id of selectedCategories) {
        for (const childId of childIdsOf(id)) matchIds.add(childId)
      }
      result = result.filter((p) => p.categoryId && matchIds.has(p.categoryId))
    }
    return result
  }, [initialProducts, selectedBrands, selectedFamily, selectedCategories, categories])

  const toggleBrand = (id: string) => {
    setSelectedBrands((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSelectedFamily(null) // reset family when brand changes
  }

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) => (prev.has(id) ? new Set() : new Set([id])))
  }

  const brandFilterCount = selectedBrands.size
  const categoryFilterCount = selectedCategories.size
  const activeFilterCount = brandFilterCount + categoryFilterCount
  const selectedBrandNames = [...selectedBrands].map((id) => brands.find((b) => b.id === id)?.name).filter(Boolean)
  const selectedCategoryNames = [...selectedCategories].map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean)

  const visibleBrands = showAllBrands ? brands : brands.slice(0, BRAND_INITIAL_SHOW)

  const clearAll = () => {
    setSelectedBrands(new Set())
    setSelectedFamily(null)
    setSelectedCategories(new Set())
  }

  // Single brand selected → show brand header
  const singleBrand = selectedBrands.size === 1 ? brands.find((b) => b.id === [...selectedBrands][0]) : null

  // Product families for the selected brand
  const brandFamilies = useMemo(() => {
    if (!singleBrand) return []
    const familyMap = new Map<string, { id: string; name: string; imageUrl: string | null }>()
    for (const p of filtered) {
      if (p.familyId && p.familyName && !familyMap.has(p.familyId)) {
        familyMap.set(p.familyId, { id: p.familyId, name: p.familyName, imageUrl: p.imageUrl })
      }
    }
    return [...familyMap.values()]
  }, [singleBrand, filtered])

  // Representative image per category id — first product image we see in
  // that category (or any of its children, for top-level rows).
  const categoryImageByCategoryId = useMemo(() => {
    const byId = new Map<string, string>()
    for (const p of initialProducts) {
      if (!p.categoryId || !p.imageUrl) continue
      if (!byId.has(p.categoryId)) byId.set(p.categoryId, p.imageUrl)
    }
    // Bubble a child image up to its top-level parent so top-level cards
    // always have an image to show even when no product is tagged directly
    // on the parent row.
    const topLevelImage = new Map<string, string>()
    for (const [catId, url] of byId) {
      const cat = categories.find((c) => c.id === catId)
      if (!cat) continue
      const topId = cat.parentId ?? cat.id
      if (!topLevelImage.has(topId)) topLevelImage.set(topId, url)
    }
    for (const [topId, url] of topLevelImage) {
      if (!byId.has(topId)) byId.set(topId, url)
    }
    return byId
  }, [initialProducts, categories])

  // Top-level category cards shown when no filters are active. Matches the
  // Collection card design used for brandFamilies below.
  const topLevelCategoryCards = useMemo(() => {
    if (singleBrand) return []
    return categorySections
      .filter((s) => s.parent.productCount > 0 || s.children.some((c) => c.productCount > 0))
      .map((s) => ({
        id: s.parent.id,
        name: s.parent.name,
        imageUrl: categoryImageByCategoryId.get(s.parent.id) ?? null,
      }))
  }, [singleBrand, categorySections, categoryImageByCategoryId])

  // Sub-category cards shown when exactly one top-level category is selected
  // and no brand is picked. Mirrors the sub-category drill-down in the
  // Category dropdown.
  const subCategoryCards = useMemo(() => {
    if (singleBrand) return []
    if (selectedCategories.size !== 1) return []
    const onlyId = [...selectedCategories][0]
    const onlyCat = categories.find((c) => c.id === onlyId)
    if (!onlyCat || onlyCat.parentId) return []
    const children = categories.filter((c) => c.parentId === onlyId && c.productCount > 0)
    return children.map((c) => ({
      id: c.id,
      name: c.name,
      imageUrl: categoryImageByCategoryId.get(c.id) ?? null,
    }))
  }, [singleBrand, selectedCategories, categories, categoryImageByCategoryId])

  return (
    <>
      {/* Filter bar */}
      <div className="discover-filter-bar">
        <div className="wrap">
          <div className="discover-filter-inner">
            {/* All filters */}
            <button
              className="filter-pill"
              data-active={activeFilterCount > 0}
              onClick={() => setDrawerOpen(true)}
              aria-label="Open all filters"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" /></svg>
              All filters
              {activeFilterCount > 0 && <span className="filter-pill-badge">{activeFilterCount}</span>}
            </button>

            <div className="filter-pill-divider" />

            {/* Category dropdown */}
            <div className="filter-pill-group" data-filter-dropdown style={{ position: "relative" }}>
              <button
                className="filter-pill"
                data-active={categoryFilterCount > 0}
                data-open={categoryDropdownOpen}
                onClick={() => { setCategoryDropdownOpen(!categoryDropdownOpen); setBrandDropdownOpen(false) }}
              >
                Category
                {categoryFilterCount > 0 && <span className="filter-pill-badge">{categoryFilterCount}</span>}
                <svg className="filter-pill-chevron" width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3.5l2.5 2.5 2.5-2.5" /></svg>
              </button>
              {categoryDropdownOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, background: "var(--background)", border: "1px solid var(--arco-rule)", borderRadius: 4, boxShadow: "0 8px 32px rgba(0,0,0,0.09)", minWidth: 280, padding: "8px 0", zIndex: 200, maxHeight: 400, overflowY: "auto" }}>
                  {categorySections.map((section) => {
                    const parentChecked = selectedCategories.has(section.parent.id)
                    const isExpanded = !!expandedCategories[section.parent.id]
                    const hasChildren = section.children.length > 0
                    return (
                      <div key={section.parent.id}>
                        <div className="filter-dropdown-option" data-checked={parentChecked ? "true" : "false"} style={{ cursor: "pointer" }} onClick={() => toggleCategory(section.parent.id)}>
                          <div className="filter-dropdown-option-left">
                            <div className="filter-checkbox">{parentChecked && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
                            <span className="filter-dropdown-label" style={{ fontWeight: 500 }}>{section.parent.name}</span>
                          </div>
                          {hasChildren && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedCategories((prev) => ({ ...prev, [section.parent.id]: !prev[section.parent.id] })) }} style={{ fontSize: 11, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", padding: "0 4px", flexShrink: 0, display: "flex", alignItems: "center", gap: 3 }}>
                              {isExpanded ? "Hide" : "Show all"}
                              <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}><path d="M2 4l3 3 3-3" /></svg>
                            </button>
                          )}
                        </div>
                        {isExpanded && section.children.map((child) => {
                          const childChecked = selectedCategories.has(child.id)
                          return (
                            <div key={child.id} className="filter-dropdown-option" data-checked={childChecked ? "true" : "false"} style={{ cursor: "pointer", paddingLeft: 36 }} onClick={() => toggleCategory(child.id)}>
                              <div className="filter-dropdown-option-left">
                                <div className="filter-checkbox">{childChecked && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
                                <span className="filter-dropdown-label">{child.name}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Brand dropdown — multi-select */}
            <div className="filter-pill-group" data-filter-dropdown style={{ position: "relative" }}>
              <button
                className="filter-pill"
                data-active={brandFilterCount > 0}
                data-open={brandDropdownOpen}
                onClick={() => { setBrandDropdownOpen(!brandDropdownOpen); setCategoryDropdownOpen(false) }}
              >
                Brand
                {brandFilterCount > 0 && <span className="filter-pill-badge">{brandFilterCount}</span>}
                <svg className="filter-pill-chevron" width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3.5l2.5 2.5 2.5-2.5" /></svg>
              </button>
              {brandDropdownOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, background: "var(--background)", border: "1px solid var(--arco-rule)", borderRadius: 4, boxShadow: "0 8px 32px rgba(0,0,0,0.09)", minWidth: 240, padding: "8px 0", zIndex: 200, maxHeight: 320, overflowY: "auto" }}>
                  {brands.map((brand) => {
                    const checked = selectedBrands.has(brand.id)
                    return (
                      <div key={brand.id} className="filter-dropdown-option" data-checked={checked ? "true" : "false"} style={{ cursor: "pointer" }} onClick={() => toggleBrand(brand.id)}>
                        <div className="filter-dropdown-option-left">
                          <div className="filter-checkbox">{checked && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
                          <span className="filter-dropdown-label">{brand.name}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active chips */}
      {activeFilterCount > 0 && (
        <div className="discover-chip-strip">
          <div className="wrap">
            <div className="discover-chip-strip-inner">
              {selectedBrandNames.map((name) => {
                const brand = brands.find((b) => b.name === name)
                return brand ? (
                  <button key={brand.id} className="filter-chip" onClick={() => toggleBrand(brand.id)}>
                    {name} <span className="filter-chip-close" aria-hidden="true">✕</span>
                  </button>
                ) : null
              })}
              {selectedCategoryNames.map((name) => {
                const cat = categories.find((c) => c.name === name)
                return cat ? (
                  <button key={cat.id} className="filter-chip" onClick={() => toggleCategory(cat.id)}>
                    {name} <span className="filter-chip-close" aria-hidden="true">✕</span>
                  </button>
                ) : null
              })}
              <button className="filter-chip-clear-all" onClick={clearAll}>Clear all</button>
            </div>
          </div>
        </div>
      )}

      {/* Page title + brand header OR default discover title */}
      <div className="discover-page-title">
        <div className="wrap">
          {(() => {
            // Category breadcrumb crumbs. With single-select categories we
            // can render at most one parent + one sub-category.
            const selectedCatId = selectedCategories.size === 1 ? [...selectedCategories][0] : null
            const selectedCat = selectedCatId ? categories.find((c) => c.id === selectedCatId) ?? null : null
            const parentCat = selectedCat?.parentId
              ? categories.find((c) => c.id === selectedCat.parentId) ?? null
              : null
            const topLevelCat = parentCat ?? selectedCat

            return (
              <nav aria-label="Breadcrumb" className="discover-breadcrumb">
                <Link
                  href="/products"
                  className="discover-breadcrumb-item"
                  onClick={(e) => {
                    if (activeFilterCount > 0) {
                      e.preventDefault()
                      clearAll()
                    }
                  }}
                >
                  Products
                </Link>

                {singleBrand && (() => {
                  // When a collection is picked, the brand crumb stops being
                  // "current" and becomes a clickable parent that clears the
                  // collection filter; the collection crumb takes over as
                  // the current leaf.
                  const activeFamily = selectedFamily
                    ? brandFamilies.find((f) => f.id === selectedFamily) ?? null
                    : null
                  return (
                    <>
                      <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
                      {activeFamily ? (
                        <button
                          type="button"
                          className="discover-breadcrumb-item"
                          onClick={() => setSelectedFamily(null)}
                        >
                          {singleBrand.name}
                        </button>
                      ) : (
                        <span className="discover-breadcrumb-item discover-breadcrumb-current">{singleBrand.name}</span>
                      )}
                      {activeFamily && (
                        <>
                          <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
                          <span className="discover-breadcrumb-item discover-breadcrumb-current">{activeFamily.name}</span>
                        </>
                      )}
                    </>
                  )
                })()}

                {!singleBrand && topLevelCat && (
                  <>
                    <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
                    {parentCat ? (
                      <button
                        type="button"
                        className="discover-breadcrumb-item"
                        onClick={() => setSelectedCategories(new Set([topLevelCat.id]))}
                      >
                        {topLevelCat.name}
                      </button>
                    ) : (
                      <span className="discover-breadcrumb-item discover-breadcrumb-current">{topLevelCat.name}</span>
                    )}
                  </>
                )}

                {!singleBrand && parentCat && selectedCat && (
                  <>
                    <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
                    <span className="discover-breadcrumb-item discover-breadcrumb-current">{selectedCat.name}</span>
                  </>
                )}
              </nav>
            )
          })()}

          {singleBrand ? (
            /* Brand header */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 16, textAlign: "center" }}>
              {singleBrand.logoUrl ? (
                <div style={{ width: 96, height: 96, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                  <Image src={singleBrand.logoUrl} alt={singleBrand.name} width={96} height={96} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ) : (
                <div style={{ width: 96, height: 96, borderRadius: "50%", background: "var(--arco-surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: "var(--text-secondary)", flexShrink: 0 }}>
                  {singleBrand.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ maxWidth: 720 }}>
                <h1 className="arco-page-title">{singleBrand.name}</h1>
                {singleBrand.description && (
                  <p className="arco-body-text" style={{ marginTop: 12 }}>{singleBrand.description}</p>
                )}
              </div>
            </div>
          ) : (
            <h1 className="arco-page-title">
              {selectedCategories.size === 1
                ? categories.find((c) => c.id === [...selectedCategories][0])?.name ?? "Discover products"
                : "Discover products"}
            </h1>
          )}
        </div>
      </div>

      {/* Top-level Category cards (no brand + no category filter). Matches the
          Collection card design below so the two families share a visual rhythm
          when users drill down from Category → Brand → Collection. */}
      {!singleBrand && selectedCategories.size === 0 && topLevelCategoryCards.length > 0 && (
        <div className="wrap" style={{ paddingBottom: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
            {topLevelCategoryCards.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCategory(c.id)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
              >
                <div style={{
                  aspectRatio: "1", borderRadius: 4, overflow: "hidden",
                  background: "var(--arco-surface)",
                  border: "2px solid transparent",
                  boxSizing: "border-box",
                  marginBottom: 8,
                }}>
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "var(--text-secondary)" }}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="arco-small-text" style={{ color: "var(--text-secondary)" }}>{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sub-category cards (one top-level category selected, no brand) */}
      {!singleBrand && subCategoryCards.length > 0 && (
        <div className="wrap" style={{ paddingBottom: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
            {subCategoryCards.map((c) => {
              const isActive = selectedCategories.has(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  style={{
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    opacity: selectedCategories.size > 1 && !isActive ? 0.4 : 1, transition: "opacity 0.15s",
                    textAlign: "left",
                  }}
                >
                  <div style={{
                    aspectRatio: "1", borderRadius: 4, overflow: "hidden",
                    background: "var(--arco-surface)",
                    border: isActive ? "2px solid var(--arco-black)" : "2px solid transparent",
                    boxSizing: "border-box",
                    marginBottom: 8,
                  }}>
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "var(--text-secondary)" }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="arco-small-text" style={{ color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}>{c.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Family cards (single brand only) */}
      {singleBrand && brandFamilies.length > 0 && (
        <div className="wrap" style={{ paddingBottom: 8 }}>
          <h4 className="arco-label" style={{ marginBottom: 16 }}>Collections</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
            {brandFamilies.map((f) => {
              const isActive = selectedFamily === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFamily(isActive ? null : f.id)}
                  style={{
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    opacity: selectedFamily && !isActive ? 0.4 : 1, transition: "opacity 0.15s",
                    textAlign: "left",
                  }}
                >
                  <div style={{
                    aspectRatio: "1", borderRadius: 4, overflow: "hidden",
                    background: "var(--arco-surface)",
                    border: isActive ? "2px solid var(--arco-black)" : "2px solid transparent",
                    boxSizing: "border-box",
                    marginBottom: 8,
                  }}>
                    {f.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.imageUrl} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "var(--text-secondary)" }}>
                        {f.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="arco-small-text" style={{ color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}>{f.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Brand icons row (no brand selected) */}
      {brands.length > 0 && selectedBrands.size === 0 && (
        <div className="wrap" style={{ paddingTop: 24, paddingBottom: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "flex-start" }}>
            {visibleBrands.map((brand) => (
              <button
                key={brand.id}
                type="button"
                onClick={() => toggleBrand(brand.id)}
                className="credit-card"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, width: 100 }}
              >
                <div className="credit-icon">
                  {brand.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logoUrl} alt={brand.name} />
                  ) : (
                    <span className="credit-icon-initials">{brand.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <h3 className="arco-label">{brand.name}</h3>
              </button>
            ))}
            {!showAllBrands && brands.length > BRAND_INITIAL_SHOW && (
              <button
                type="button"
                onClick={() => setShowAllBrands(true)}
                className="credit-card"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, width: 100 }}
              >
                <div className="credit-icon" style={{ background: "transparent", border: "1px solid var(--rule)" }}>
                  <span className="credit-icon-initials" style={{ fontSize: 14 }}>+{brands.length - BRAND_INITIAL_SHOW}</span>
                </div>
                <h3 className="arco-label" style={{ color: "var(--text-secondary)" }}>Show all</h3>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="discover-results">
        <div className="wrap">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <h2 className="arco-section-title empty-state__title">No products found</h2>
              <p className="arco-body-text empty-state__description">Try adjusting your filters.</p>
              <button type="button" onClick={clearAll} className="btn-primary empty-state__action">Clear filters</button>
            </div>
          ) : (
            <>
              <div className="discover-results-meta">
                <p className="discover-results-count">
                  <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{filtered.length}</strong> products
                </p>
              </div>
              <div className="discover-grid">
                {filtered.map((product) => (
                  <Link key={product.id} href={`/products/${product.brandSlug}/${product.slug}`} className="discover-card">
                    <div className="discover-card-image-wrap">
                      {product.imageUrl ? (
                        <div className="discover-card-image-layer">
                          <SmartImage src={product.imageUrl} alt={product.name} />
                        </div>
                      ) : (
                        <div className="discover-card-image-layer" style={{ background: "var(--arco-surface)" }} />
                      )}
                    </div>
                    <div className="pro-card-info">
                      {product.brandLogoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.brandLogoUrl} alt="" className="pro-card-logo" width={34} height={34} loading="lazy" />
                      ) : (
                        <div className="pro-card-logo pro-card-logo-placeholder">
                          {product.brandName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h3 className="discover-card-title">{product.name}</h3>
                        <p className="discover-card-sub">{[product.brandName, product.categoryName].filter(Boolean).join(" · ")}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* All filters drawer — mirrors the /projects discover pattern
          (.discover-drawer styles live in globals.css). Contains the same
          filters as the top pills (Category, Brand, Collection), plus a
          Clear all / Show results footer. */}
      <div
        className="discover-drawer-backdrop"
        data-open={drawerOpen}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      <aside
        className="discover-drawer"
        data-open={drawerOpen}
        role="dialog"
        aria-modal="true"
        aria-label="All filters"
      >
        <div className="discover-drawer-header">
          <span className="discover-drawer-title">All filters</span>
          <button
            className="discover-drawer-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3l10 10M13 3l-10 10" />
            </svg>
          </button>
        </div>

        <div className="discover-drawer-body">
          {/* Category */}
          <div className="drawer-section">
            <div className="drawer-section-header" style={{ cursor: "default" }}>
              <div className="drawer-section-header-left">
                <span className="drawer-section-title">Category</span>
                {categoryFilterCount > 0 && (
                  <span className="drawer-section-badge">{categoryFilterCount} selected</span>
                )}
              </div>
            </div>
            <div className="drawer-section-body">
              <div className="drawer-option-list">
                {categorySections.map((section) => {
                  const parentChecked = selectedCategories.has(section.parent.id)
                  const isExpanded = !!expandedCategories[section.parent.id]
                  return (
                    <div key={section.parent.id}>
                      <div
                        className="drawer-option"
                        data-checked={parentChecked}
                        role="option"
                        aria-selected={parentChecked}
                        onClick={() => toggleCategory(section.parent.id)}
                      >
                        <div className="drawer-option-left">
                          <div className="drawer-option-checkbox">{parentChecked && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
                          <span className="drawer-option-label" style={{ fontWeight: 500 }}>{section.parent.name}</span>
                        </div>
                        {section.children.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setExpandedCategories((prev) => ({ ...prev, [section.parent.id]: !prev[section.parent.id] })) }}
                            style={{ fontSize: 11, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", padding: "0 4px", flexShrink: 0 }}
                          >
                            {isExpanded ? "Hide" : "Show all"}
                          </button>
                        )}
                      </div>
                      {isExpanded && section.children.map((child) => {
                        const childChecked = selectedCategories.has(child.id)
                        return (
                          <div
                            key={child.id}
                            className="drawer-option"
                            data-checked={childChecked}
                            role="option"
                            aria-selected={childChecked}
                            style={{ paddingLeft: 36 }}
                            onClick={() => toggleCategory(child.id)}
                          >
                            <div className="drawer-option-left">
                              <div className="drawer-option-checkbox">{childChecked && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
                              <span className="drawer-option-label">{child.name}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Brand */}
          <div className="drawer-section">
            <div className="drawer-section-header" style={{ cursor: "default" }}>
              <div className="drawer-section-header-left">
                <span className="drawer-section-title">Brand</span>
                {brandFilterCount > 0 && (
                  <span className="drawer-section-badge">{brandFilterCount} selected</span>
                )}
              </div>
            </div>
            <div className="drawer-section-body">
              <div className="drawer-option-list">
                {brands.map((brand) => {
                  const checked = selectedBrands.has(brand.id)
                  return (
                    <div
                      key={brand.id}
                      className="drawer-option"
                      data-checked={checked}
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggleBrand(brand.id)}
                    >
                      <div className="drawer-option-left">
                        <div className="drawer-option-checkbox">{checked && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
                        <span className="drawer-option-label">{brand.name}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Collection — only when a single brand with families is in view */}
          {singleBrand && brandFamilies.length > 0 && (
            <div className="drawer-section">
              <div className="drawer-section-header" style={{ cursor: "default" }}>
                <div className="drawer-section-header-left">
                  <span className="drawer-section-title">Collection</span>
                  {selectedFamily && (
                    <span className="drawer-section-badge">1 selected</span>
                  )}
                </div>
              </div>
              <div className="drawer-section-body">
                <div className="drawer-option-list">
                  {brandFamilies.map((f) => {
                    const checked = selectedFamily === f.id
                    return (
                      <div
                        key={f.id}
                        className="drawer-option"
                        data-checked={checked}
                        role="option"
                        aria-selected={checked}
                        onClick={() => setSelectedFamily(checked ? null : f.id)}
                      >
                        <div className="drawer-option-left">
                          <div className="drawer-option-checkbox">{checked && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
                          <span className="drawer-option-label">{f.name}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="discover-drawer-footer">
          <button
            className="discover-drawer-clear"
            onClick={() => { clearAll(); setDrawerOpen(false) }}
          >
            Clear all
          </button>
          <button
            className="discover-drawer-apply"
            onClick={() => setDrawerOpen(false)}
          >
            Show results
          </button>
        </div>
      </aside>
    </>
  )
}
