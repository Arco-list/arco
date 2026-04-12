"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { scrapeProduct, discoverCatalog, batchScrapeProducts, type DiscoveredProduct } from "../actions"

type Brand = {
  id: string
  slug: string
  name: string
  domain: string | null
  website: string | null
  logo_url: string | null
  description: string | null
  country: string | null
  status: string
}

type Product = {
  id: string
  slug: string
  name: string
  description: string | null
  source_url: string | null
  status: string
  scraped_at: string | null
  product_photos: { url: string; is_primary: boolean }[]
}

export function BrandDetailClient({ brand, products }: { brand: Brand; products: Product[] }) {
  const router = useRouter()

  // Single product scrape
  const [scrapeUrl, setScrapeUrl] = useState("")
  const [isScraping, setIsScraping] = useState(false)

  // Catalog discovery
  const [catalogUrl, setCatalogUrl] = useState("")
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [discovered, setDiscovered] = useState<DiscoveredProduct[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isBatchScraping, setIsBatchScraping] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return
    setIsScraping(true)
    try {
      const result = await scrapeProduct(scrapeUrl.trim(), brand.id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success(`Added ${result.name}`)
        setScrapeUrl("")
        router.refresh()
      }
    } finally {
      setIsScraping(false)
    }
  }

  const handleDiscover = async () => {
    if (!catalogUrl.trim()) return
    setIsDiscovering(true)
    setDiscovered([])
    setSelected(new Set())
    try {
      const result = await discoverCatalog(catalogUrl.trim(), brand.id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        setDiscovered(result.products)
        // Select all by default
        setSelected(new Set(result.products.map((p) => p.url)))
        if (result.products.length === 0) {
          toast.error("No product pages found on this URL.")
        } else {
          toast.success(`Found ${result.products.length} products`)
        }
      }
    } finally {
      setIsDiscovering(false)
    }
  }

  const toggleSelect = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === discovered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(discovered.map((p) => p.url)))
    }
  }

  const handleBatchScrape = async () => {
    const urls = discovered.filter((p) => selected.has(p.url)).map((p) => p.url)
    if (urls.length === 0) return

    setIsBatchScraping(true)
    setBatchProgress(0)

    try {
      const result = await batchScrapeProducts(urls, brand.id)

      let successes = 0
      let failures = 0
      for (const r of result.results) {
        if ("error" in r) failures++
        else successes++
      }
      setBatchProgress(100)
      toast.success(`Scraped ${successes} products${failures > 0 ? `, ${failures} failed` : ""}`)
      setDiscovered([])
      setSelected(new Set())
      setCatalogUrl("")
      router.refresh()
    } finally {
      setIsBatchScraping(false)
    }
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <Link href="/admin/brands" className="arco-small-text" style={{ display: "inline-block", marginBottom: 24 }}>
        ← All brands
      </Link>

      {/* Brand header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 24, marginBottom: 40 }}>
        {brand.logo_url ? (
          <img src={brand.logo_url} alt={brand.name} style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#f5f5f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "#6b6b68", flexShrink: 0 }}>
            {brand.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 className="arco-page-title">{brand.name}</h2>
          {brand.description && <p className="arco-body-text" style={{ marginTop: 8, maxWidth: 600 }}>{brand.description}</p>}
          <div className="arco-eyebrow" style={{ marginTop: 12 }}>
            {[brand.country, brand.domain, brand.status].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      {/* ── Catalog discovery ── */}
      <div style={{ marginBottom: 40, padding: 24, border: "1px solid var(--rule)", borderRadius: 6 }}>
        <h4 className="arco-label" style={{ marginBottom: 12 }}>Discover products from catalog</h4>
        <p className="arco-small-text" style={{ marginBottom: 12 }}>
          Paste the brand's products or collection page URL. We'll try the sitemap first, then scrape the page to find all product links.
        </p>
        <div className="flex gap-2" style={{ maxWidth: 700 }}>
          <input
            type="url"
            placeholder={`https://www.${brand.domain ?? "brand.com"}/products`}
            value={catalogUrl}
            onChange={(e) => setCatalogUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleDiscover() }}
            className="input-base input-default"
            style={{ flex: 1 }}
            disabled={isDiscovering || isBatchScraping}
          />
          <button
            type="button"
            className="btn-primary"
            style={{ fontSize: 14, padding: "10px 20px" }}
            onClick={handleDiscover}
            disabled={isDiscovering || isBatchScraping || !catalogUrl.trim()}
          >
            {isDiscovering ? "Discovering…" : "Discover products"}
          </button>
        </div>

        {/* Discovered products checklist */}
        {discovered.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span className="arco-small-text">
                <strong style={{ color: "var(--text-primary)" }}>{selected.size}</strong> of {discovered.length} selected
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn-tertiary"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  onClick={toggleAll}
                >
                  {selected.size === discovered.length ? "Deselect all" : "Select all"}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ fontSize: 12, padding: "6px 16px" }}
                  onClick={handleBatchScrape}
                  disabled={isBatchScraping || selected.size === 0}
                >
                  {isBatchScraping ? `Scraping… (${batchProgress}%)` : `Scrape ${selected.size} products`}
                </button>
              </div>
            </div>

            <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid var(--rule)", borderRadius: 4 }}>
              {discovered.map((product) => {
                const isSelected = selected.has(product.url)
                return (
                  <label
                    key={product.url}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      borderBottom: "1px solid var(--rule)",
                      cursor: "pointer",
                      background: isSelected ? "var(--arco-white)" : "transparent",
                      transition: "background 0.1s",
                    }}
                  >
                    <input
                      type="checkbox"
                      className="arco-table-checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(product.url)}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="arco-table-primary">{product.name}</div>
                      <div className="arco-table-secondary" style={{ marginTop: 2 }}>{product.url}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Single product scrape (fallback) ── */}
      <div className="flex flex-col gap-2 mb-8 max-w-2xl">
        <label className="arco-eyebrow">Add single product by URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder={`https://www.${brand.domain ?? "brand.com"}/products/...`}
            value={scrapeUrl}
            onChange={(e) => setScrapeUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleScrape() }}
            className="input-base input-default"
            style={{ flex: 1 }}
            disabled={isScraping}
          />
          <button
            type="button"
            className="btn-tertiary"
            style={{ fontSize: 14, padding: "10px 20px" }}
            onClick={handleScrape}
            disabled={isScraping || !scrapeUrl.trim()}
          >
            {isScraping ? "Scraping…" : "Scrape product"}
          </button>
        </div>
      </div>

      {/* Products grid */}
      <h4 className="arco-label" style={{ marginBottom: 20 }}>Products ({products.length})</h4>
      {products.length === 0 ? (
        <div className="empty-state">
          <p className="arco-body-text empty-state__description">No products yet. Use the catalog discovery above to get started.</p>
        </div>
      ) : (
        <div className="discover-grid">
          {products.map((product) => {
            const primary = product.product_photos.find((p) => p.is_primary) ?? product.product_photos[0]
            return (
              <Link key={product.id} href={`/products/${product.slug}`} className="discover-card">
                <div className="discover-card-image-wrap">
                  {primary ? (
                    <div className="discover-card-image-layer">
                      <img src={primary.url} alt={product.name} />
                    </div>
                  ) : (
                    <div className="discover-card-image-layer" style={{ background: "var(--arco-surface)" }} />
                  )}
                </div>
                <h3 className="discover-card-title">{product.name}</h3>
                <p className="discover-card-sub">{product.status}</p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
