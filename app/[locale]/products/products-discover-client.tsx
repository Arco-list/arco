"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { DiscoverProduct, DiscoverBrand, DiscoverCategory } from "./page"

const BRAND_INITIAL_SHOW = 8

interface Props {
  initialProducts: DiscoverProduct[]
  brands: DiscoverBrand[]
  categories: DiscoverCategory[]
}

export function ProductsDiscoverClient({ initialProducts, brands, categories }: Props) {
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [showAllBrands, setShowAllBrands] = useState(false)
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  // Build hierarchical category sections: parent → children
  const categorySections = useMemo(() => {
    const topLevel = categories.filter((c) => !c.parentId)
    // Phase 1: show all categories regardless of product count.
    // Phase 4: filter to categories with products.
    return topLevel.map((parent) => ({
      parent,
      children: categories.filter((c) => c.parentId === parent.id),
    }))
  }, [categories])

  // All category IDs under a parent (parent + children)
  const childIdsOf = (parentId: string) => {
    const children = categories.filter((c) => c.parentId === parentId)
    return [parentId, ...children.map((c) => c.id)]
  }

  // Filter products
  const filtered = useMemo(() => {
    let result = initialProducts
    if (selectedBrand) {
      result = result.filter((p) => p.brandId === selectedBrand)
    }
    if (selectedCategories.size > 0) {
      // Build the full set of IDs to match: selected IDs + their children
      const matchIds = new Set<string>()
      for (const id of selectedCategories) {
        for (const childId of childIdsOf(id)) matchIds.add(childId)
      }
      result = result.filter((p) => p.categoryId && matchIds.has(p.categoryId))
    }
    return result
  }, [initialProducts, selectedBrand, selectedCategories, categories])

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const categoryFilterCount = selectedCategories.size
  const activeFilterCount = (selectedBrand ? 1 : 0) + categoryFilterCount
  const selectedBrandName = brands.find((b) => b.id === selectedBrand)?.name
  const selectedCategoryNames = [...selectedCategories].map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean)

  const visibleBrands = showAllBrands ? brands : brands.slice(0, BRAND_INITIAL_SHOW)

  const clearAll = () => {
    setSelectedBrand(null)
    setSelectedCategories(new Set())
  }

  return (
    <>
      {/* Filter bar — sticky below header */}
      <div className="discover-filter-bar">
        <div className="wrap">
          <div className="discover-filter-inner">
            {/* All filters */}
            <button
              className="filter-pill"
              data-active={activeFilterCount > 0}
              onClick={clearAll}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" /></svg>
              All filters
              {activeFilterCount > 0 && <span className="filter-pill-badge">{activeFilterCount}</span>}
            </button>

            <div className="filter-pill-divider" />

            {/* Category dropdown — hierarchical with expandable sub-categories */}
            <div className="filter-pill-group" style={{ position: "relative" }}>
              <button
                className="filter-pill"
                data-active={categoryFilterCount > 0}
                data-open={categoryDropdownOpen}
                onClick={() => { setCategoryDropdownOpen(!categoryDropdownOpen); setBrandDropdownOpen(false) }}
              >
                Category
                {categoryFilterCount > 0 && <span className="filter-pill-badge">{categoryFilterCount}</span>}
                <svg className="filter-pill-chevron" width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3.5l2.5 2.5 2.5-2.5" />
                </svg>
              </button>
              {categoryDropdownOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, background: "var(--background)", border: "1px solid var(--arco-rule)", borderRadius: 4, boxShadow: "0 8px 32px rgba(0,0,0,0.09)", minWidth: 280, padding: "8px 0", zIndex: 200, maxHeight: 400, overflowY: "auto" }}>
                  {categorySections.map((section) => {
                    const parentChecked = selectedCategories.has(section.parent.id)
                    const isExpanded = !!expandedCategories[section.parent.id]
                    const hasChildren = section.children.length > 0
                    return (
                      <div key={section.parent.id}>
                        <div
                          className="filter-dropdown-option"
                          data-checked={parentChecked ? "true" : "false"}
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleCategory(section.parent.id)}
                        >
                          <div className="filter-dropdown-option-left">
                            <div className="filter-checkbox">
                              {parentChecked && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                            </div>
                            <span className="filter-dropdown-label" style={{ fontWeight: 500 }}>{section.parent.name}</span>
                          </div>
                          {hasChildren && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedCategories((prev) => ({ ...prev, [section.parent.id]: !prev[section.parent.id] }))
                              }}
                              style={{ fontSize: 11, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", padding: "0 4px", flexShrink: 0, display: "flex", alignItems: "center", gap: 3 }}
                            >
                              {isExpanded ? "Hide" : "Show all"}
                              <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>
                                <path d="M2 4l3 3 3-3" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {isExpanded && section.children.map((child) => {
                          const childChecked = selectedCategories.has(child.id)
                          return (
                            <div
                              key={child.id}
                              className="filter-dropdown-option"
                              data-checked={childChecked ? "true" : "false"}
                              style={{ cursor: "pointer", paddingLeft: 36 }}
                              onClick={() => toggleCategory(child.id)}
                            >
                              <div className="filter-dropdown-option-left">
                                <div className="filter-checkbox">
                                  {childChecked && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                </div>
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

            {/* Brand dropdown */}
            <div className="filter-pill-group" style={{ position: "relative" }}>
              <button
                className="filter-pill"
                data-active={!!selectedBrand}
                data-open={brandDropdownOpen}
                onClick={() => { setBrandDropdownOpen(!brandDropdownOpen); setCategoryDropdownOpen(false) }}
              >
                {selectedBrandName ?? "Brand"}
                {selectedBrand && <span className="filter-pill-badge">1</span>}
                <svg className="filter-pill-chevron" width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3.5l2.5 2.5 2.5-2.5" />
                </svg>
              </button>
              {brandDropdownOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, background: "var(--background)", border: "1px solid var(--arco-rule)", borderRadius: 4, boxShadow: "0 8px 32px rgba(0,0,0,0.09)", minWidth: 240, padding: "8px 0", zIndex: 200, maxHeight: 320, overflowY: "auto" }}>
                  <div
                    className="filter-dropdown-option"
                    data-checked={!selectedBrand ? "true" : "false"}
                    style={{ cursor: "pointer" }}
                    onClick={() => { setSelectedBrand(null); setBrandDropdownOpen(false) }}
                  >
                    <div className="filter-dropdown-option-left">
                      <div className="filter-checkbox">{!selectedBrand && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
                      <span className="filter-dropdown-label">All brands</span>
                    </div>
                  </div>
                  {brands.map((brand) => (
                    <div
                      key={brand.id}
                      className="filter-dropdown-option"
                      data-checked={selectedBrand === brand.id ? "true" : "false"}
                      style={{ cursor: "pointer" }}
                      onClick={() => { setSelectedBrand(selectedBrand === brand.id ? null : brand.id); setBrandDropdownOpen(false) }}
                    >
                      <div className="filter-dropdown-option-left">
                        <div className="filter-checkbox">{selectedBrand === brand.id && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
                        <span className="filter-dropdown-label">{brand.name}</span>
                      </div>
                    </div>
                  ))}
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
              {selectedBrandName && (
                <button className="filter-chip" onClick={() => setSelectedBrand(null)}>
                  {selectedBrandName} <span className="filter-chip-close" aria-hidden="true">✕</span>
                </button>
              )}
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

      {/* Page title */}
      <div className="discover-page-title">
        <div className="wrap">
          <nav aria-label="Breadcrumb" className="discover-breadcrumb">
            <Link href="/products" className="discover-breadcrumb-item">Products</Link>
            <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
            <span className="discover-breadcrumb-item discover-breadcrumb-current">Nederland</span>
          </nav>
          <h2 className="arco-section-title">Discover products</h2>
        </div>
      </div>

      {/* Brand icons row */}
      {brands.length > 0 && !selectedBrand && (
        <div className="wrap" style={{ paddingBottom: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "flex-start" }}>
            {visibleBrands.map((brand) => (
              <Link
                key={brand.id}
                href={`/products/${brand.slug}`}
                className="credit-card"
                style={{ padding: 0, width: 100 }}
              >
                <div className="credit-icon">
                  {brand.logoUrl ? (
                    <img src={brand.logoUrl} alt={brand.name} />
                  ) : (
                    <span className="credit-icon-initials">{brand.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <h3 className="arco-label">{brand.name}</h3>
              </Link>
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
                  <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{filtered.length}</strong>{" "}
                  {selectedBrandName ? `${selectedBrandName} products` : "products"}
                </p>
              </div>
              <div className="discover-grid">
                {filtered.map((product) => (
                  <Link key={product.id} href={`/products/${product.brandSlug}/${product.slug}`} className="discover-card">
                    <div className="discover-card-image-wrap">
                      {product.imageUrl ? (
                        <div className="discover-card-image-layer">
                          <img src={product.imageUrl} alt={product.name} />
                        </div>
                      ) : (
                        <div className="discover-card-image-layer" style={{ background: "var(--arco-surface)" }} />
                      )}
                    </div>
                    <div className="pro-card-info">
                      {product.brandLogoUrl ? (
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
    </>
  )
}
