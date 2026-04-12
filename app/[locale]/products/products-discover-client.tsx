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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showAllBrands, setShowAllBrands] = useState(false)
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)

  // Top-level categories only for the filter bar
  const topCategories = useMemo(
    () => categories.filter((c) => !c.parentId && c.productCount > 0),
    [categories]
  )

  // Filter products
  const filtered = useMemo(() => {
    let result = initialProducts
    if (selectedBrand) {
      result = result.filter((p) => p.brandId === selectedBrand)
    }
    if (selectedCategory) {
      const catName = categories.find((c) => c.id === selectedCategory)?.name
      if (catName) {
        result = result.filter((p) => p.categoryName === catName)
      }
    }
    return result
  }, [initialProducts, selectedBrand, selectedCategory, categories])

  const activeFilterCount = (selectedBrand ? 1 : 0) + (selectedCategory ? 1 : 0)
  const selectedBrandName = brands.find((b) => b.id === selectedBrand)?.name
  const selectedCategoryName = categories.find((c) => c.id === selectedCategory)?.name

  const visibleBrands = showAllBrands ? brands : brands.slice(0, BRAND_INITIAL_SHOW)

  const clearAll = () => {
    setSelectedBrand(null)
    setSelectedCategory(null)
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

            {/* Category dropdown */}
            <div className="filter-pill-group" style={{ position: "relative" }}>
              <button
                className="filter-pill"
                data-active={!!selectedCategory}
                data-open={categoryDropdownOpen}
                onClick={() => { setCategoryDropdownOpen(!categoryDropdownOpen); setBrandDropdownOpen(false) }}
              >
                {selectedCategoryName ?? "Category"}
                {selectedCategory && <span className="filter-pill-badge">1</span>}
                <svg className="filter-pill-chevron" width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3.5l2.5 2.5 2.5-2.5" />
                </svg>
              </button>
              {categoryDropdownOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, background: "var(--background)", border: "1px solid var(--arco-rule)", borderRadius: 4, boxShadow: "0 8px 32px rgba(0,0,0,0.09)", minWidth: 220, padding: "8px 0", zIndex: 200 }}>
                  <div
                    className="filter-dropdown-option"
                    data-checked={!selectedCategory ? "true" : "false"}
                    style={{ cursor: "pointer" }}
                    onClick={() => { setSelectedCategory(null); setCategoryDropdownOpen(false) }}
                  >
                    <div className="filter-dropdown-option-left">
                      <div className="filter-checkbox">{!selectedCategory && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
                      <span className="filter-dropdown-label">All categories</span>
                    </div>
                  </div>
                  {topCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="filter-dropdown-option"
                      data-checked={selectedCategory === cat.id ? "true" : "false"}
                      style={{ cursor: "pointer" }}
                      onClick={() => { setSelectedCategory(selectedCategory === cat.id ? null : cat.id); setCategoryDropdownOpen(false) }}
                    >
                      <div className="filter-dropdown-option-left">
                        <div className="filter-checkbox">{selectedCategory === cat.id && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
                        <span className="filter-dropdown-label">{cat.name}</span>
                      </div>
                    </div>
                  ))}
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
              {selectedCategoryName && (
                <button className="filter-chip" onClick={() => setSelectedCategory(null)}>
                  {selectedCategoryName} <span className="filter-chip-close" aria-hidden="true">✕</span>
                </button>
              )}
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
              <button
                key={brand.id}
                type="button"
                onClick={() => setSelectedBrand(brand.id)}
                className="credit-card"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, width: 100 }}
              >
                <div className="credit-icon">
                  {brand.logoUrl ? (
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
                  <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{filtered.length}</strong>{" "}
                  {selectedBrandName ? `${selectedBrandName} products` : "products"}
                </p>
              </div>
              <div className="discover-grid">
                {filtered.map((product) => (
                  <Link key={product.id} href={`/products/${product.slug}`} className="discover-card">
                    <div className="discover-card-image-wrap">
                      {product.imageUrl ? (
                        <div className="discover-card-image-layer">
                          <img src={product.imageUrl} alt={product.name} />
                        </div>
                      ) : (
                        <div className="discover-card-image-layer" style={{ background: "var(--arco-surface)" }} />
                      )}
                    </div>
                    <h3 className="discover-card-title">{product.name}</h3>
                    <p className="discover-card-sub">{product.brandName}</p>
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
