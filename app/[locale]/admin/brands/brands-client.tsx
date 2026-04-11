"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { MoreHorizontal } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { scrapeBrand, updateBrandStatus, deleteBrand } from "./actions"
import type { AdminBrandRow } from "./page"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const STATUS_DOT: Record<string, string> = {
  unclaimed: "#ea580c",
  prospected: "#f59e0b",
  unlisted: "#a1a1a0",
  listed: "#7c3aed",
  deactivated: "#dc2626",
}

const STATUS_LABEL: Record<string, string> = {
  unclaimed: "Unclaimed",
  prospected: "Prospected",
  unlisted: "Unlisted",
  listed: "Listed",
  deactivated: "Deactivated",
}

export function BrandsClient({ initialBrands }: { initialBrands: AdminBrandRow[] }) {
  const router = useRouter()
  const [brands, setBrands] = useState(initialBrands)
  const [scrapeUrl, setScrapeUrl] = useState("")
  const [isScraping, setIsScraping] = useState(false)
  const [, startTransition] = useTransition()

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return
    setIsScraping(true)
    try {
      const result = await scrapeBrand(scrapeUrl.trim())
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success(result.created ? `Added ${result.name}` : `${result.name} already exists`)
        setScrapeUrl("")
        router.refresh()
      }
    } finally {
      setIsScraping(false)
    }
  }

  const handleStatusChange = (brandId: string, status: string) => {
    startTransition(async () => {
      const result = await updateBrandStatus(brandId, status)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Status updated")
        setBrands((prev) => prev.map((b) => (b.id === brandId ? { ...b, status } : b)))
      }
    })
  }

  const handleDelete = (brandId: string) => {
    if (!confirm("Delete this brand and all its products? This cannot be undone.")) return
    startTransition(async () => {
      const result = await deleteBrand(brandId)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Brand deleted")
        setBrands((prev) => prev.filter((b) => b.id !== brandId))
      }
    })
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="flex flex-col gap-1 mb-6">
        <h3 className="arco-section-title">Brands</h3>
        <p className="text-xs text-[#a1a1a0] mt-0.5">
          {brands.length} {brands.length === 1 ? "brand" : "brands"}
        </p>
      </div>

      {/* Scrape input */}
      <div className="flex flex-col gap-2 mb-8 max-w-2xl">
        <label className="arco-eyebrow">Add brand by URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://www.occhio.com"
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
            {isScraping ? "Scraping…" : "Scrape brand"}
          </button>
        </div>
        <p className="arco-small-text">Paste a brand homepage URL — Firecrawl + Claude will extract the name, description, and country.</p>
      </div>

      {/* Table */}
      <div className="arco-table-wrap">
        <table className="arco-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Brand</th>
              <th>Domain</th>
              <th>Country</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Products</th>
              <th>Created</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {brands.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>
                  No brands yet. Paste a URL above to scrape your first brand.
                </td>
              </tr>
            ) : (
              brands.map((brand) => (
                <tr key={brand.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {brand.logo_url ? (
                        <div className="arco-table-avatar">
                          <img src={brand.logo_url} alt={brand.name} />
                        </div>
                      ) : (
                        <div className="arco-table-avatar" style={{ background: "#f5f5f4", color: "#6b6b68" }}>
                          {brand.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <Link href={`/admin/brands/${brand.id}`} className="arco-table-primary arco-table-primary--wrap hover:text-[#016D75] transition-colors">
                          {brand.name}
                        </Link>
                        {brand.description && (
                          <div className="arco-table-secondary">{brand.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    {brand.website ? (
                      <a href={brand.website} target="_blank" rel="noopener noreferrer" className="arco-table-primary hover:opacity-70 transition-opacity" style={{ fontWeight: 400 }}>
                        {brand.domain ?? "—"}
                      </a>
                    ) : (
                      <span className="arco-table-secondary" style={{ marginTop: 0 }}>—</span>
                    )}
                  </td>
                  <td>{brand.country ?? <span className="arco-table-secondary" style={{ marginTop: 0 }}>—</span>}</td>
                  <td>
                    <span className="arco-table-status">
                      <span className="arco-table-status-dot" style={{ background: STATUS_DOT[brand.status] ?? "#a1a1a0" }} />
                      <span style={{ fontWeight: 500 }}>{STATUS_LABEL[brand.status] ?? brand.status}</span>
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>{brand.product_count}</td>
                  <td className="arco-table-nowrap">{format(new Date(brand.created_at), "dd MMM yyyy")}</td>
                  <td style={{ textAlign: "center" }}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="arco-table-action" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/brands/${brand.id}`}>View brand</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/brands/${brand.slug}`} target="_blank">Open public page</Link>
                        </DropdownMenuItem>
                        {Object.entries(STATUS_LABEL).map(([key, label]) => (
                          <DropdownMenuItem key={key} onClick={() => handleStatusChange(brand.id, key)} disabled={brand.status === key}>
                            Set status: {label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem onClick={() => handleDelete(brand.id)} className="text-red-600">
                          Delete brand
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
