"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AdminProductRow } from "./page"

const STATUS_DOT: Record<string, string> = {
  listed: "#7c3aed",
  unlisted: "#a1a1a0",
}

const STATUS_LABEL: Record<string, string> = {
  listed: "Listed",
  unlisted: "Unlisted",
}

export function ProductsClient({ initialProducts }: { initialProducts: AdminProductRow[] }) {
  const [search, setSearch] = useState("")

  const filtered = initialProducts.filter((p) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      (p.brand?.name ?? "").toLowerCase().includes(q) ||
      (p.category?.name ?? "").toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="flex flex-col gap-1 mb-6">
        <h3 className="arco-section-title">Products</h3>
        <p className="text-xs text-[#a1a1a0] mt-0.5">
          {filtered.length} of {initialProducts.length} {initialProducts.length === 1 ? "product" : "products"}
        </p>
      </div>

      <div className="mb-6 max-w-md">
        <input
          type="text"
          placeholder="Search by product, brand, or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-base input-default"
          style={{ width: "100%" }}
        />
      </div>

      <div className="arco-table-wrap">
        <table className="arco-table" style={{ minWidth: 1000 }}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Brand</th>
              <th>Category</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Photos</th>
              <th>Created</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>
                  No products yet. Scrape products from a brand page in /admin/brands.
                </td>
              </tr>
            ) : (
              filtered.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {product.primary_photo ? (
                        <div className="arco-table-avatar">
                          <img src={product.primary_photo} alt={product.name} />
                        </div>
                      ) : (
                        <div className="arco-table-avatar" style={{ background: "#f5f5f4", color: "#6b6b68" }}>
                          {product.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <Link href={`/admin/products/${product.id}`} className="arco-table-primary arco-table-primary--wrap hover:text-[#016D75] transition-colors">
                          {product.name}
                        </Link>
                        {product.description && (
                          <div className="arco-table-secondary">{product.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    {product.brand ? (
                      <Link href={`/admin/brands/${product.brand.id}`} className="arco-table-primary hover:opacity-70 transition-opacity" style={{ fontWeight: 400 }}>
                        {product.brand.name}
                      </Link>
                    ) : (
                      <span className="arco-table-secondary" style={{ marginTop: 0 }}>—</span>
                    )}
                  </td>
                  <td>{product.category?.name ?? <span className="arco-table-secondary" style={{ marginTop: 0 }}>—</span>}</td>
                  <td>
                    <span className="arco-table-status">
                      <span className="arco-table-status-dot" style={{ background: STATUS_DOT[product.status] ?? "#a1a1a0" }} />
                      <span style={{ fontWeight: 500 }}>{STATUS_LABEL[product.status] ?? product.status}</span>
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>{product.photo_count}</td>
                  <td className="arco-table-nowrap">{format(new Date(product.created_at), "dd MMM yyyy")}</td>
                  <td style={{ textAlign: "center" }}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="arco-table-action" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/products/${product.id}`}>View product</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/products/${product.slug}`} target="_blank">Open public page</Link>
                        </DropdownMenuItem>
                        {product.source_url && (
                          <DropdownMenuItem asChild>
                            <a href={product.source_url} target="_blank" rel="noopener noreferrer">View source URL</a>
                          </DropdownMenuItem>
                        )}
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
