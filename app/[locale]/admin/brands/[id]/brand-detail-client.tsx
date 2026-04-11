"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { scrapeProduct } from "../actions"

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
  const [scrapeUrl, setScrapeUrl] = useState("")
  const [isScraping, setIsScraping] = useState(false)

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

      {/* Scrape product input */}
      <div className="flex flex-col gap-2 mb-8 max-w-2xl">
        <label className="arco-eyebrow">Add product by URL</label>
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
            className="btn-primary"
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
          <p className="arco-body-text empty-state__description">No products yet. Paste a product URL above to start.</p>
        </div>
      ) : (
        <div className="discover-grid">
          {products.map((product) => {
            const primary = product.product_photos.find((p) => p.is_primary) ?? product.product_photos[0]
            return (
              <Link key={product.id} href={`/admin/products/${product.id}`} className="discover-card">
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
